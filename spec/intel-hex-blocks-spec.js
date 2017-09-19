'use strict';



// https://github.com/uxitten/polyfill/blob/master/string.polyfill.js
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/padStart
if (!String.prototype.padStart) {
    String.prototype.padStart = function padStart(targetLength,padString) {
        targetLength = targetLength>>0; //floor if number or convert non-number to 0;
        padString = String(padString || ' ');
        if (this.length > targetLength) {
            return String(this);
        }
        else {
            targetLength = targetLength-this.length;
            if (targetLength > padString.length) {
                padString += padString.repeat(targetLength/padString.length); //append to original to ensure we are longer than needed
            }
            return padString.slice(0,targetLength) + String(this);
        }
    };
}



describe("intel-hex block operations", function() {

    let intelHex = typeof window !== 'undefined' ?
        module.exports : // When running specRunner on a browser
        require('../intel-hex');    // When running on node


    describe("overlapBlockSets", function() {
        describe('no-overlap idempotence', ()=>{
            it('one block set of one block', () => {
                let bytes = (new Uint8Array(16)).map((i,j)=>j+16);

                let blocks = new Map([[128, bytes]]);

                let blockSets = new Map([['foo', blocks]]);

                let overlaps = intelHex.overlapBlockSets(blockSets);

                expect(overlaps.size).toBe(1);
                expect(overlaps.has(128)).toBe(true);
                expect(overlaps.get(128).length).toBe(1);
                expect(overlaps.get(128)[0][0]).toBe('foo');
                expect(overlaps.get(128)[0][1]).toEqual(bytes);
            });

            it('one block set of two blocks', () => {
                let bytes1 = (new Uint8Array(16)).map((i,j)=>j+16);
                let bytes2 = (new Uint8Array(16)).map((i,j)=>j+128);

                let blocks = new Map([[0x00B8, bytes1], [0xFC00, bytes2]]);

                let blockSets = new Map([['foo', blocks]]);

                let overlaps = intelHex.overlapBlockSets(blockSets);

                expect(overlaps.size).toBe(2);
                expect(overlaps.has(0x00B8)).toBe(true);
                expect(overlaps.get(0x00B8).length).toBe(1);
                expect(overlaps.get(0x00B8)[0][0]).toBe('foo');
                expect(overlaps.get(0x00B8)[0][1]).toEqual(bytes1);
                expect(overlaps.has(0xFC00)).toBe(true);
                expect(overlaps.get(0xFC00).length).toBe(1);
                expect(overlaps.get(0xFC00)[0][0]).toBe('foo');
                expect(overlaps.get(0xFC00)[0][1]).toEqual(bytes2);
            });

            it('two block sets of one block', () => {
                let bytes1 = (new Uint8Array(16)).map((i,j)=>j+16);
                let bytes2 = (new Uint8Array(16)).map((i,j)=>j+128);

                let blocks1 = new Map([[0x00B8, bytes1]]);
                let blocks2 = new Map([[0xFC00, bytes2]]);

                let blockSets = new Map([['foo', blocks1], ['bar', blocks2]]);

                let overlaps = intelHex.overlapBlockSets(blockSets);

                expect(overlaps.size).toBe(2);
                expect(overlaps.has(0x00B8)).toBe(true);
                expect(overlaps.get(0x00B8).length).toBe(1);
                expect(overlaps.get(0x00B8)[0][0]).toBe('foo');
                expect(overlaps.get(0x00B8)[0][1]).toEqual(bytes1);
                expect(overlaps.has(0xFC00)).toBe(true);
                expect(overlaps.get(0xFC00).length).toBe(1);
                expect(overlaps.get(0xFC00)[0][0]).toBe('bar');
                expect(overlaps.get(0xFC00)[0][1]).toEqual(bytes2);
            });

            it('two block sets of two blocks', () => {
                let bytes1 = (new Uint8Array(16)).map((i,j)=>j+16);
                let bytes2 = (new Uint8Array(16)).map((i,j)=>j+128);
                let bytes3 = (new Uint8Array(128)).map((i,j)=>j);
                let bytes4 = (new Uint8Array(128)).map((i,j)=>j+99);

                let blocks1 = new Map([[0x00B8, bytes1], [0x1080, bytes2]]);
                let blocks2 = new Map([[0x0A20, bytes3], [0xFC00, bytes4]]);

                let blockSets = new Map([['foo', blocks1], ['bar', blocks2]]);

                let overlaps = intelHex.overlapBlockSets(blockSets);

                expect(overlaps.size).toBe(4);
                expect(overlaps.has(0x00B8)).toBe(true);
                expect(overlaps.get(0x00B8).length).toBe(1);
                expect(overlaps.get(0x00B8)[0][0]).toBe('foo');
                expect(overlaps.get(0x00B8)[0][1]).toEqual(bytes1);
                expect(overlaps.has(0x0A20)).toBe(true);
                expect(overlaps.get(0x0A20).length).toBe(1);
                expect(overlaps.get(0x0A20)[0][0]).toBe('bar');
                expect(overlaps.get(0x0A20)[0][1]).toEqual(bytes3);
                expect(overlaps.has(0x1080)).toBe(true);
                expect(overlaps.get(0x1080).length).toBe(1);
                expect(overlaps.get(0x1080)[0][0]).toBe('foo');
                expect(overlaps.get(0x1080)[0][1]).toEqual(bytes2);
                expect(overlaps.has(0xFC00)).toBe(true);
                expect(overlaps.get(0xFC00).length).toBe(1);
                expect(overlaps.get(0xFC00)[0][0]).toBe('bar');
                expect(overlaps.get(0xFC00)[0][1]).toEqual(bytes4);
            });
        });

        describe('two overlapping blocksets', ()=>{
            it('two block sets fully overlapping', () => {
                let bytes = (new Uint8Array(16)).map((i,j)=>j+16);

                let blocks1 = new Map([[128, bytes]]);
                let blocks2 = new Map([[128, bytes]]);

                let blockSets = new Map([['foo', blocks1], ['bar', blocks2]]);

                let overlaps = intelHex.overlapBlockSets(blockSets);

                expect(overlaps.size).toBe(1);
                expect(overlaps.has(128)).toBe(true);
                expect(overlaps.get(128).length).toBe(2);
                expect(overlaps.get(128)[0][0]).toBe('foo');
                expect(overlaps.get(128)[0][1]).toEqual(bytes);
                expect(overlaps.get(128)[1][0]).toBe('bar');
                expect(overlaps.get(128)[1][1]).toEqual(bytes);
            });

            it('two block sets overlapping at the start', () => {
                let bytes1 = (new Uint8Array(16)).map((i,j)=>j+16);
                let bytes2 = (new Uint8Array(32)).map((i,j)=>j+48);

                let blocks1 = new Map([[128, bytes1]]);
                let blocks2 = new Map([[128, bytes2]]);

                let blockSets = new Map([['foo', blocks1], ['bar', blocks2]]);

                let overlaps = intelHex.overlapBlockSets(blockSets);

                expect(overlaps.size).toBe(2);
                expect(overlaps.has(128)).toBe(true);
                expect(overlaps.get(128).length).toBe(2);
                expect(overlaps.get(128)[0][0]).toBe('foo');
                expect(overlaps.get(128)[0][1]).toEqual(bytes1);
                expect(overlaps.get(128)[1][0]).toBe('bar');
                expect(overlaps.get(128)[1][1]).toEqual(bytes2.subarray(0, 16));
                expect(overlaps.has(128+16)).toBe(true);
                expect(overlaps.get(128+16).length).toBe(1);
                expect(overlaps.get(128+16)[0][0]).toBe('bar');
                expect(overlaps.get(128+16)[0][1]).toEqual(bytes2.subarray(16, 32));
            });

            it('two block sets overlapping at the end', () => {
                let bytes1 = (new Uint8Array(32)).map((i,j)=>j+48);
                let bytes2 = (new Uint8Array(16)).map((i,j)=>j+16);

                let blocks1 = new Map([[128, bytes1]]);
                let blocks2 = new Map([[128 + 16, bytes2]]);

                let blockSets = new Map([['foo', blocks1], ['bar', blocks2]]);

                let overlaps = intelHex.overlapBlockSets(blockSets);

                expect(overlaps.size).toBe(2);
                expect(overlaps.has(128)).toBe(true);
                expect(overlaps.get(128).length).toBe(1);
                expect(overlaps.get(128)[0][0]).toBe('foo');
                expect(overlaps.get(128)[0][1]).toEqual(bytes1.subarray(0, 16));
                expect(overlaps.has(128+16)).toBe(true);
                expect(overlaps.get(128+16).length).toBe(2);
                expect(overlaps.get(128+16)[0][0]).toBe('foo');
                expect(overlaps.get(128+16)[0][1]).toEqual(bytes1.subarray(16, 32));
                expect(overlaps.get(128+16)[1][0]).toBe('bar');
                expect(overlaps.get(128+16)[1][1]).toEqual(bytes2);
            });

            it('two 2-byte block sets partially overlapping one byte', () => {
                let bytes1 = new Uint8Array([0x80, 0x81]);
                let bytes2 = new Uint8Array(      [0x82, 0x83]);

                let blocks1 = new Map([[0xFFF0, bytes1]]);
                let blocks2 = new Map([[0xFFF1, bytes2]]);

                let blockSets = new Map([['foo', blocks1], ['bar', blocks2]]);

                let overlaps = intelHex.overlapBlockSets(blockSets);

                expect(overlaps.size).toBe(3);
                expect(overlaps.has(0xFFF0)).toBe(true);
                expect(overlaps.get(0xFFF0).length).toBe(1);
                expect(overlaps.get(0xFFF0)[0][0]).toBe('foo');
                expect(overlaps.get(0xFFF0)[0][1]).toEqual(new Uint8Array([0x80]));
                expect(overlaps.has(0xFFF1)).toBe(true);
                expect(overlaps.get(0xFFF1).length).toBe(2);
                expect(overlaps.get(0xFFF1)[0][0]).toBe('foo');
                expect(overlaps.get(0xFFF1)[0][1]).toEqual(new Uint8Array([0x81]));
                expect(overlaps.get(0xFFF1)[1][0]).toBe('bar');
                expect(overlaps.get(0xFFF1)[1][1]).toEqual(new Uint8Array([0x82]));
                expect(overlaps.has(0xFFF2)).toBe(true);
                expect(overlaps.get(0xFFF2).length).toBe(1);
                expect(overlaps.get(0xFFF2)[0][0]).toBe('bar');
                expect(overlaps.get(0xFFF2)[0][1]).toEqual(new Uint8Array([0x83]));
            });

            it('one 1-byte block partially overlapping one 3-byte block', () => {
                let bytes1 = new Uint8Array(      [0x83]);
                let bytes2 = new Uint8Array([0x80, 0x81, 0x82]);

                let blocks1 = new Map([[0xFFF1, bytes1]]);
                let blocks2 = new Map([[0xFFF0, bytes2]]);

                let blockSets = new Map([['foo', blocks1], ['bar', blocks2]]);

                let overlaps = intelHex.overlapBlockSets(blockSets);

                expect(overlaps.size).toBe(3);
                expect(overlaps.has(0xFFF0)).toBe(true);
                expect(overlaps.get(0xFFF0).length).toBe(1);
                expect(overlaps.get(0xFFF0)[0][0]).toBe('bar');
                expect(overlaps.get(0xFFF0)[0][1]).toEqual(new Uint8Array([0x80]));
                expect(overlaps.has(0xFFF1)).toBe(true);
                expect(overlaps.get(0xFFF1).length).toBe(2);
                expect(overlaps.get(0xFFF1)[0][0]).toBe('foo');
                expect(overlaps.get(0xFFF1)[0][1]).toEqual(new Uint8Array([0x83]));
                expect(overlaps.get(0xFFF1)[1][0]).toBe('bar');
                expect(overlaps.get(0xFFF1)[1][1]).toEqual(new Uint8Array([0x81]));
                expect(overlaps.has(0xFFF2)).toBe(true);
                expect(overlaps.get(0xFFF2).length).toBe(1);
                expect(overlaps.get(0xFFF2)[0][0]).toBe('bar');
                expect(overlaps.get(0xFFF2)[0][1]).toEqual(new Uint8Array([0x82]));
            });
        });

        describe('three overlapping blocksets', ()=>{
            it('three 3-byte blocks offset by 1', () => {
                let bytes1 = new Uint8Array([0x80, 0x81, 0x82]);
                let bytes2 = new Uint8Array(      [0x90, 0x91, 0x92]);
                let bytes3 = new Uint8Array(            [0xA0, 0xA1, 0xA2]);

                let blocks1 = new Map([[0xFFF0, bytes1]]);
                let blocks2 = new Map([[0xFFF1, bytes2]]);
                let blocks3 = new Map([[0xFFF2, bytes3]]);

                let blockSets = new Map([['foo', blocks1], ['bar', blocks2], ['quux', blocks3]]);

                let overlaps = intelHex.overlapBlockSets(blockSets);

                expect(overlaps).toEqual(new Map([
                    [0xFFF0, [['foo', new Uint8Array([0x80])]]],
                    [0xFFF1, [['foo', new Uint8Array([0x81])], ['bar', new Uint8Array([0x90])]]],
                    [0xFFF2, [['foo', new Uint8Array([0x82])], ['bar', new Uint8Array([0x91])], ['quux', new Uint8Array([0xA0])]]],
                    [0xFFF3, [['bar', new Uint8Array([0x92])], ['quux', new Uint8Array([0xA1])]]],
                    [0xFFF4, [['quux', new Uint8Array([0xA2])]]],
                ]));

            });

            it('three 3-byte blocks offset by 2', () => {
                let bytes1 = new Uint8Array([0x80, 0x81, 0x82]);
                let bytes2 = new Uint8Array(            [0x90, 0x91, 0x92]);
                let bytes3 = new Uint8Array(                        [0xA0, 0xA1, 0xA2]);

                let blocks1 = new Map([[0xFFF0, bytes1]]);
                let blocks2 = new Map([[0xFFF2, bytes2]]);
                let blocks3 = new Map([[0xFFF4, bytes3]]);

                let blockSets = new Map([['foo', blocks1], ['bar', blocks2], ['quux', blocks3]]);

                let overlaps = intelHex.overlapBlockSets(blockSets);

                expect(overlaps).toEqual(new Map([
                    [0xFFF0, [['foo', new Uint8Array([0x80, 0x81])]]],
                    [0xFFF2, [['foo', new Uint8Array([0x82])], ['bar', new Uint8Array([0x90])]]],
                    [0xFFF3, [['bar', new Uint8Array([0x91])]]],
                    [0xFFF4, [['bar', new Uint8Array([0x92])], ['quux', new Uint8Array([0xA0])]]],
                    [0xFFF5, [['quux', new Uint8Array([0xA1, 0xA2])]]],
                ]));

            });

        });
    });

    describe("flattenOverlaps", ()=>{

        it('flattens five overlaps', ()=>{
            const overlaps = new Map([
                [0xFFF0, [['foo', new Uint8Array([0x80])]]],
                [0xFFF1, [['foo', new Uint8Array([0x81])], ['bar', new Uint8Array([0x90])]]],
                [0xFFF2, [['foo', new Uint8Array([0x82])], ['bar', new Uint8Array([0x91])], ['quux', new Uint8Array([0xA0])]]],
                [0xFFF3, [['bar', new Uint8Array([0x92])], ['quux', new Uint8Array([0xA1])]]],
                [0xFFF4, [['quux', new Uint8Array([0xA2])]]],
            ]);

            const flattened = intelHex.flattenOverlaps(overlaps);

            expect(flattened).toEqual(new Map([
                [0xFFF0, new Uint8Array([0x80])],
                [0xFFF1, new Uint8Array([0x90])],
                [0xFFF2, new Uint8Array([0xA0])],
                [0xFFF3, new Uint8Array([0xA1])],
                [0xFFF4, new Uint8Array([0xA2])]
            ]));

            expect(intelHex.joinBlocks(flattened)).toEqual(new Map([
                [0xFFF0, new Uint8Array([0x80, 0x90, 0xA0, 0xA1, 0xA2])]
            ]));

        });
    });

    describe("paginate", ()=>{

        describe("Input sanity", ()=>{

            it('Throws exception on negative page size', () => {
                const bytes = (new Uint8Array([1]));
                const blocks = new Map([[0, bytes]]);

                expect(()=>{
                    const pages = intelHex.paginate(blocks, -8);
                }).toThrow(new Error('Page size must be greater than zero'));

                expect(()=>{
                    const pages = intelHex.paginate(blocks, 0);
                }).toThrow(new Error('Page size must be greater than zero'));
            });
        });

        describe("Single page output", ()=>{

            it('Converts a one-byte block at offset zero into one 8-byte page', ()=>{
                const bytes = (new Uint8Array([1]));
                const blocks = new Map([[0, bytes]]);

                const pages = intelHex.paginate(blocks, 8);

                expect(pages).toEqual(new Map([
                    [0, new Uint8Array([0x01, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF ])]
                ]));
            });

            it('Converts a one-byte block at offset zero into one 16-byte page', ()=>{
                const bytes = (new Uint8Array([1]));
                const blocks = new Map([[0, bytes]]);

                const pages = intelHex.paginate(blocks, 16);

                expect(pages).toEqual(new Map([
                    [0, new Uint8Array([0x01, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
                                        0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF ])]
                ]));
            });

            it('Converts a 16-byte block at offset zero into one 16-byte page', ()=>{
                const bytes = (new Uint8Array(16)).map((i,j)=>j+1);
                const blocks = new Map([[0, bytes]]);

                const pages = intelHex.paginate(blocks, 16);

                expect(pages).toEqual(new Map([
                    [0, new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
                                        0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F, 0x10])]
                ]));
            });

            it('Converts a one-byte block at high offset into one 8-byte page', ()=>{
                const bytes = (new Uint8Array([1]));
                const blocks = new Map([[0x654321, bytes]]);

                const pages = intelHex.paginate(blocks, 8);

                expect(pages).toEqual(new Map([
                    [0x654320, new Uint8Array([0xFF, 0x01, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF ])]
                ]));

            });

            it('Converts a one-byte block at high offset into one 16-byte page', ()=>{
                const bytes = (new Uint8Array([1]));
                const blocks = new Map([[0x654321, bytes]]);

                const pages = intelHex.paginate(blocks, 16);

                expect(pages).toEqual(new Map([
                    [0x654320, new Uint8Array([0xFF, 0x01, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
                                               0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF ])]
                ]));

            });

            it('Converts an aligned 16-byte block at high offset into one 16-byte page', ()=>{
                const bytes = (new Uint8Array(16)).map((i,j)=>j+1);
                const blocks = new Map([[0x654320, bytes]]);

                const pages = intelHex.paginate(blocks, 16);

                expect(pages).toEqual(new Map([
                    [0x654320, new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
                                               0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F, 0x10])]
                ]));
            });
        });

        describe("Multiple page output", ()=>{

            it('Converts an misaligned 16-byte block at low offset into two 16-byte pages', ()=>{
                const bytes = (new Uint8Array(16)).map((i,j)=>j+1);
                const blocks = new Map([[0x04, bytes]]);

                const pages = intelHex.paginate(blocks, 16);

                expect(pages).toEqual(new Map([
                    [0x00, new Uint8Array([0xFF, 0xFF, 0xFF, 0xFF, 0x01, 0x02, 0x03, 0x04,
                                           0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0x0C])],
                    [0x10, new Uint8Array([0x0D, 0x0E, 0x0F, 0x10, 0xFF, 0xFF, 0xFF, 0xFF,
                                           0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF])]
                ]));
            });

            it('Converts an misaligned 16-byte block at high offset into two 16-byte pages', ()=>{
                const bytes = (new Uint8Array(16)).map((i,j)=>j+1);
                const blocks = new Map([[0x654324, bytes]]);

                const pages = intelHex.paginate(blocks, 16);

                expect(pages).toEqual(new Map([
                    [0x654320, new Uint8Array([0xFF, 0xFF, 0xFF, 0xFF, 0x01, 0x02, 0x03, 0x04,
                                               0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0x0C])],
                    [0x654330, new Uint8Array([0x0D, 0x0E, 0x0F, 0x10, 0xFF, 0xFF, 0xFF, 0xFF,
                                               0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF])]
                ]));
            });

            it('Converts an misaligned 16-byte block at high offset into three 8-byte pages', ()=>{
                const bytes = (new Uint8Array(16)).map((i,j)=>j+1);
                const blocks = new Map([[0x654324, bytes]]);

                const pages = intelHex.paginate(blocks, 8);

                expect(pages).toEqual(new Map([
                    [0x654320, new Uint8Array([0xFF, 0xFF, 0xFF, 0xFF, 0x01, 0x02, 0x03, 0x04])],
                    [0x654328, new Uint8Array([0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0x0C])],
                    [0x654330, new Uint8Array([0x0D, 0x0E, 0x0F, 0x10, 0xFF, 0xFF, 0xFF, 0xFF])],
                ]));
            });

        });

        describe("Multiple block input", ()=>{
            it('Merges two contiguous 8-byte blocks into one page at offset zero', ()=>{
                const bytes1 = (new Uint8Array(8)).map((i,j)=>j+1);
                const bytes2 = (new Uint8Array(8)).map((i,j)=>j+9);
                const blocks = new Map([[0x00, bytes1], [0x08, bytes2]]);

                const pages = intelHex.paginate(blocks, 16);

                expect(pages).toEqual(new Map([
                    [0, new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
                                        0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F, 0x10])]
                ]));
            });

            it('Merges two aligned contiguous 8-byte blocks into one page at high offset', ()=>{
                const bytes1 = (new Uint8Array(8)).map((i,j)=>j+1);
                const bytes2 = (new Uint8Array(8)).map((i,j)=>j+9);
                const blocks = new Map([[0x654320, bytes1], [0x654328, bytes2]]);

                const pages = intelHex.paginate(blocks, 16);

                expect(pages).toEqual(new Map([
                    [0x654320, new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
                                               0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F, 0x10])]
                ]));
            });

            it('Merges four sparse 2-byte blocks into one page at offset zero', ()=>{
                const blocks = new Map([
                    [0x00, new Uint8Array([0x01, 0x02])],
                    [0x03, new Uint8Array([0x03, 0x04])],
                    [0x07, new Uint8Array([0x05, 0x06])],
                    [0x0C, new Uint8Array([0x07, 0x08])],
                ]);

                const pages = intelHex.paginate(blocks, 16);

                expect(pages).toEqual(new Map([
                    [0, new Uint8Array([0x01, 0x02, 0xFF, 0x03, 0x04, 0xFF, 0xFF, 0x05,
                                        0x06, 0xFF, 0xFF, 0xFF, 0x07, 0x08, 0xFF, 0xFF])]
                ]));
            });

            it('Merges four sparse 4-byte blocks into two pages at offset zero', ()=>{
                const blocks = new Map([
                    [0x00, new Uint8Array([0x01, 0x02, 0x03, 0x04])],
                    [0x07, new Uint8Array([0x05, 0x06, 0x07, 0x08])],
                    [0x0D, new Uint8Array([0x09, 0x0A, 0x0B, 0x0C])],
                    [0x18, new Uint8Array([0x0D, 0x0E, 0x0F, 0x10])],
                ]);

                const pages = intelHex.paginate(blocks, 16);

                expect(pages).toEqual(new Map([
                    [0x00, new Uint8Array([0x01, 0x02, 0x03, 0x04, 0xFF, 0xFF, 0xFF, 0x05,
                                           0x06, 0x07, 0x08, 0xFF, 0xFF, 0x09, 0x0A, 0x0B])],
                    [0x10, new Uint8Array([0x0C, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
                                           0x0D, 0x0E, 0x0F, 0x10, 0xFF, 0xFF, 0xFF, 0xFF])],
                ]));
            });

            it('Merges four sparse 4-byte blocks into two pages at high offset', ()=>{
                const blocks = new Map([
                    [0x6543200, new Uint8Array([0x01, 0x02, 0x03, 0x04])],
                    [0x6543207, new Uint8Array([0x05, 0x06, 0x07, 0x08])],
                    [0x654320D, new Uint8Array([0x09, 0x0A, 0x0B, 0x0C])],
                    [0x6543218, new Uint8Array([0x0D, 0x0E, 0x0F, 0x10])],
                ]);

                const pages = intelHex.paginate(blocks, 16);

                expect(pages).toEqual(new Map([
                    [0x6543200, new Uint8Array([0x01, 0x02, 0x03, 0x04, 0xFF, 0xFF, 0xFF, 0x05,
                                           0x06, 0x07, 0x08, 0xFF, 0xFF, 0x09, 0x0A, 0x0B])],
                    [0x6543210, new Uint8Array([0x0C, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
                                           0x0D, 0x0E, 0x0F, 0x10, 0xFF, 0xFF, 0xFF, 0xFF])],
                ]));
            });

            /// TODO: Add tests for the padding character

        });

    });


    describe("getUint32", ()=>{
        it('Returns undefined on empty input blocks', ()=>{
            const blocks = new Map([]);
            expect(intelHex.getUint32(blocks, 0)).toBe(undefined);
        });

        it('Gets a Uint32 at offset zero', ()=>{
            const blocks = new Map([
                [0x0, new Uint8Array([0x01, 0x02, 0x03, 0x04])]
            ]);
            expect(intelHex.getUint32(blocks, 0)).toBe(0x01020304);
        });
        it('Gets a little-endian Uint32 at offset zero', ()=>{
            const blocks = new Map([
                [0x0, new Uint8Array([0x01, 0x02, 0x03, 0x04])]
            ]);
            expect(intelHex.getUint32(blocks, 0, true)).toBe(0x04030201);
        });

        it('Gets a Uint32 at non-zero offset', ()=>{
            const bytes = (new Uint8Array(16)).map((i,j)=>j+1);
            const blocks = new Map([[0, bytes]]);

            expect(intelHex.getUint32(blocks, 8)).toBe(0x090A0B0C);
        });
        it('Gets a little-endian Uint32 at non-zero offset', ()=>{
            const bytes = (new Uint8Array(16)).map((i,j)=>j+1);
            const blocks = new Map([[0, bytes]]);

            expect(intelHex.getUint32(blocks, 8, true)).toBe(0x0C0B0A09);
        });

        it('Gets a Uint32 at non-zero offset with several blocks', ()=>{
            const bytes1 = (new Uint8Array(16)).map((i,j)=>j+0x01);
            const bytes2 = (new Uint8Array(16)).map((i,j)=>j+0x11);
            const bytes3 = (new Uint8Array(16)).map((i,j)=>j+0x21);
            const blocks = new Map([
                [0x1000, bytes1],
                [0x2000, bytes2],
                [0x3000, bytes3]
            ]);

            expect(intelHex.getUint32(blocks, 0x2004)).toBe(0x15161718);
        });
        it('Gets a little-endian Uint32 at non-zero offset with several blocks', ()=>{
            const bytes1 = (new Uint8Array(16)).map((i,j)=>j+0x01);
            const bytes2 = (new Uint8Array(16)).map((i,j)=>j+0x11);
            const bytes3 = (new Uint8Array(16)).map((i,j)=>j+0x21);
            const blocks = new Map([
                [0x1000, bytes1],
                [0x2000, bytes2],
                [0x3000, bytes3]
            ]);

            expect(intelHex.getUint32(blocks, 0x2004, true)).toBe(0x18171615);
        });

        it('Returns undefined on partial overlaps', ()=>{
            const blocks = new Map([
                [0x0, new Uint8Array([0x01, 0x02, 0x03, 0x04])],
                [0x4, new Uint8Array([0x05, 0x06, 0x07, 0x08])],

            ]);
            expect(intelHex.getUint32(blocks, 2, true)).toBe(undefined);
        });

    });

});
