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



describe("intel-hex", function() {

    let intelHex = typeof window !== 'undefined' ?
        module.exports : // When running specRunner on a browser
        require('../intel-hex');    // When running on node

    describe("hexToArrays", function() {

            describe('File consistency', ()=>{
            it('Throws exception on empty input', () => {
                expect(()=>{
                    intelHex.hexToArrays('');
                }).toThrow(new Error('Malformed .hex file, could not parse any registers'));
            });

            it('Returns an empty Map when passed only an EOF record', () => {
                let blocks = intelHex.hexToArrays(':00000001FF');
                expect(blocks.size).toBe(0);
            });

            it('Throws exception on no records found', () => {
                expect(()=>{
                    intelHex.hexToArrays(':00000foobar001FF');
                }).toThrow(new Error('Malformed .hex file, could not parse any registers'));
            });

            it('Throws exception on wrong-length EOF record', () => {
                expect(()=>{
                    intelHex.hexToArrays(':02000001FF');
                }).toThrow(new Error('Mismatched record length at record 1 (:02000001FF), expected 2 data bytes but actual length is 0'));
            });

            it('Throws exception on missing EOF record', () => {
                expect(()=>{
                    intelHex.hexToArrays(':100000000102030405060708090A0B0C0D0E0F1068\n');
                }).toThrow(new Error('No EOF record at end of file'));
            });
        });

        describe('Record consistency', ()=>{

            it('Throws exception on wrong-length data record', () => {
                expect(()=>{
                    intelHex.hexToArrays(
                        ':10000000010203040506070868\n' +
                        ':00000001FF');
                }).toThrow(new Error('Mismatched record length at record 1 (:10000000010203040506070868), expected 16 data bytes but actual length is 8'));
            });

            it('Throws exception on wrong checksum of EOF', () => {
                expect(()=>{
                    intelHex.hexToArrays(':0000000188');
                }).toThrow(new Error('Checksum failed at record 1 (:0000000188), should be ff'));
            });

            it('Throws exception on wrong checksum of data record', () => {
                expect(()=>{
                    intelHex.hexToArrays(
                        ':080000000102030405060708FF\n' +
                        ':00000001FF');
                }).toThrow(new Error('Checksum failed at record 1 (:080000000102030405060708FF), should be d4'));
            });

            it('Returns an empty Map when passed an EOF record', () => {
                let blocks = intelHex.hexToArrays(':00000001FF');
                expect(blocks.size).toBe(0);
            });

            it('Throws exception if there is data after an EOF record', () => {
                expect(()=>{
                    let blocks = intelHex.hexToArrays(
                        ':00000001FF\n' +
                        ':100000000102030405060708090A0B0C0D0E0F1068\n');
                }).toThrow(new Error('There is data after an EOF record at record 1'));
            });
        });

        it('Returns one block when passed a zero-offset data record', () => {
            let blocks = intelHex.hexToArrays(
                ':100000000102030405060708090A0B0C0D0E0F1068\n' +
                ':00000001FF');
            expect(blocks.size).toBe(1);
            expect(blocks.get(0)).toBeDefined();
            const block = blocks.get(0);
            expect(block.length).toBe(16);
            for (let i=0; i<16; i++) {
                expect(block[i]).toBe(i+1);
            }
        });

        it('Returns one block when passed lowercase records', () => {
            let blocks = intelHex.hexToArrays(
                ':100000000102030405060708090a0b0c0d0e0f1068\n' +
                ':00000001ff');
            expect(blocks.size).toBe(1);
            expect(blocks.get(0)).toBeDefined();
            const block = blocks.get(0);
            expect(block.length).toBe(16);
            for (let i=0; i<16; i++) {
                expect(block[i]).toBe(i+1);
            }
        });

        it('Silently ignores program-counter-reset records', () => {
            let blocks = intelHex.hexToArrays(
                ':040000050001C0C175\n' +
                ':0400000512345678E3\n' +
                ':100000000102030405060708090A0B0C0D0E0F1068\n' +
                ':040000050001C0C175\n' +
                ':0400000312345678E5\n' +
                ':040000030001C0C177\n' +
                ':00000001FF');
            expect(blocks.size).toBe(1);
            expect(blocks.get(0)).toBeDefined();
            const block = blocks.get(0);
            expect(block.length).toBe(16);
            for (let i=0; i<16; i++) {
                expect(block[i]).toBe(i+1);
            }
        });

        describe('Newline parsing', ()=>{
            it('Handles \\n', () => {
                let blocks = intelHex.hexToArrays(
                    ':100000000102030405060708090A0B0C0D0E0F1068' +
                    '\n' +
                    ':00000001FF');
                expect(blocks.size).toBe(1);
                expect(blocks.get(0).length).toBe(16);
            });

            it('Handles \\r', () => {
                let blocks = intelHex.hexToArrays(
                    ':100000000102030405060708090A0B0C0D0E0F1068' +
                    '\r' +
                    ':00000001FF');
                expect(blocks.size).toBe(1);
                expect(blocks.get(0).length).toBe(16);
            });

            it('Handles \\r\\n', () => {
                let blocks = intelHex.hexToArrays(
                    ':100000000102030405060708090A0B0C0D0E0F1068' +
                    '\r\n' +
                    ':00000001FF');
                expect(blocks.size).toBe(1);
                expect(blocks.get(0).length).toBe(16);
            });

            it('Handles data without newlines', () => {
                let blocks = intelHex.hexToArrays(
                    ':100000000102030405060708090A0B0C0D0E0F1068' +
                    ':00000001FF');
                expect(blocks.size).toBe(1);
                expect(blocks.get(0).length).toBe(16);
            });

            it('Throws error on unknown record separator', () => {
                expect(()=>{
                    let blocks = intelHex.hexToArrays(
                        ':100000000102030405060708090A0B0C0D0E0F1068' +
                        '|' +
                        ':00000001FF');
                }).toThrow();
            });
        });

        describe('Contiguous data', ()=>{
            it('Returns one block when passed a non-zero-offset data record', () => {
                let blocks = intelHex.hexToArrays(
                    ':101234000102030405060708090A0B0C0D0E0F1022\n' +
                    ':00000001FF');
                expect(blocks.size).toBe(1);
                expect(blocks.get(0x1234)).toBeDefined();
                const block = blocks.get(0x1234);
                expect(block.length).toBe(16);
                for (let i=0; i<16; i++) {
                    expect(block[i]).toBe(i+1);
                }
            });

            it('Returns one block when passed a segment address and a non-zero-offset data record', () => {
                let blocks = intelHex.hexToArrays(
                    ':020000021234B6\n' +
                    ':100056000102030405060708090A0B0C0D0E0F1012\n' +
                    ':00000001FF');
                expect(blocks.size).toBe(1);
                // Segment address offset is   0x00012340 (from segment addr 0x1234)
                // Data offset is              0x00000056
                // Segment addr off + data off 0x00012396
                expect(blocks.get(0x12396)).toBeDefined();
                const block = blocks.get(0x12396);
                expect(block.length).toBe(16);
                for (let i=0; i<16; i++) {
                    expect(block[i]).toBe(i+1);
                }
            });

            it('Returns one block when passed a linear address and a non-zero-offset data record', () => {
                let blocks = intelHex.hexToArrays(
                    ':020000041234B4\n' +
                    ':105678000102030405060708090A0B0C0D0E0F109A\n' +
                    ':00000001FF');
                expect(blocks.size).toBe(1);
                // Linear address offset is   0x12340000 (from upper linear addr 0x1234)
                // Data offset is             0x00005678
                // Linear addr off + data off 0x12345678
                expect(blocks.get(0x12345678)).toBeDefined();
                const block = blocks.get(0x12345678);
                expect(block.length).toBe(16);
                for (let i=0; i<16; i++) {
                    expect(block[i]).toBe(i+1);
                }
            });

            it('Only the last linear address record has effect', () => {
                let blocks = intelHex.hexToArrays(
                    ':0200000456782C\n' +
                    ':020000040000FA\n' +
                    ':101234000102030405060708090A0B0C0D0E0F1022\n' +
                    ':00000001FF');
                expect(blocks.size).toBe(1);
                expect(blocks.get(0x1234)).toBeDefined();
                const block = blocks.get(0x1234);
                for (let i=0; i<16; i++) {
                    expect(block[i]).toBe(i+1);
                }
            });

            it('Return one block when passed 8 consecutive records', () => {
                let blocks = intelHex.hexToArrays(
                    ':020000040001F9\n' +
                    ':10C00000C039002049C1010063C1010065C10100C0\n' +
                    ':10C010000000000000000000000000000000000020\n' +
                    ':10C0200000000000000000000000000067C10100E7\n' +
                    ':10C03000000000000000000069C101006BC10100A8\n' +
                    ':10C040006DC101006DC10100DDC401006DC10100C1\n' +
                    ':10C050006DC101000000000099C201006DC1010026\n' +
                    ':10C060006DC101006DC101006DC101006DC1010014\n' +
                    ':10C070006DC101006DC101006DC101006DC1010004\n' +
                    ':00000001FF');
                expect(blocks.size).toBe(1);
                expect(blocks.get(0x0001C000)).toBeDefined();
                const block = blocks.get(0x0001C000);
                expect(block.length).toBe(128);
            });
        });

        describe('Sparse data', ()=>{
            it('Returns two blocks when passed two sparse data records', () => {
                let blocks = intelHex.hexToArrays(
                    ':100000000102030405060708090A0B0C0D0E0F1068\n' +
                    ':020000041234B4\n' +
                    ':100000001112131415161718191A1B1C1D1E1F2068\n' +
                    ':00000001FF');
                expect(blocks.size).toBe(2);
                expect(blocks.get(0)).toBeDefined();
                let block = blocks.get(0);
                for (let i=0; i<16; i++) {
                    expect(block[i]).toBe(i+1);
                }
                expect(blocks.get(0x12340000)).toBeDefined();
                block = blocks.get(0x12340000);
                for (let i=0; i<16; i++) {
                    expect(block[i]).toBe(i+17);
                }
            });

            it('Returns one contiguous block when passed two contiguous data records', () => {
                let blocks = intelHex.hexToArrays(
                    ':100000000102030405060708090A0B0C0D0E0F1068\n' +
                    ':100010001112131415161718191A1B1C1D1E1F2058\n' +
                    ':00000001FF');
                expect(blocks.size).toBe(1);
                expect(blocks.get(0)).toBeDefined();
                let block = blocks.get(0);
                expect(block.length).toBe(32);
                for (let i=0; i<32; i++) {
                    expect(block[i]).toBe(i+1);
                }
            });

            it('Returns one contiguous block when passed two out-of-order contiguous data records', () => {
                let blocks = intelHex.hexToArrays(
                    ':100010001112131415161718191A1B1C1D1E1F2058\n' +
                    ':100000000102030405060708090A0B0C0D0E0F1068\n' +
                    ':00000001FF');
                expect(blocks.size).toBe(1);
                expect(blocks.get(0)).toBeDefined();
                let block = blocks.get(0);
                expect(block.length).toBe(32);
                for (let i=0; i<32; i++) {
                    expect(block[i]).toBe(i+1);
                }
            });

            it('Throws exception on duplicated data records', () => {
                expect(()=>{
                    let blocks = intelHex.hexToArrays(
                        ':100000000102030405060708090A0B0C0D0E0F1068\n' +
                        ':100000000102030405060708090A0B0C0D0E0F1068\n' +
                        ':00000001FF\n');
                }).toThrow(new Error('Duplicated data at record 2 (:100000000102030405060708090A0B0C0D0E0F1068)'));
            });

            it('Throws exception on overlapping data records', () => {
                expect(()=>{
                    let blocks = intelHex.hexToArrays(
                        ':100000000102030405060708090A0B0C0D0E0F1068\n' +
                        ':100008000102030405060708090A0B0C0D0E0F1060\n' +
                        ':00000001FF\n');
                }).toThrow(new Error('Overlapping data around address 0x8'));
            });

            it('Returned Map\'s insertion order is strictly ascending', () => {
                let blocks = intelHex.hexToArrays(
                    ':101000000102030405060708090A0B0C0D0E0F1058\n' +
                    ':105000000102030405060708090A0B0C0D0E0F1018\n' +
                    ':103000000102030405060708090A0B0C0D0E0F1038\n' +
                    ':102000000102030405060708090A0B0C0D0E0F1048\n' +
                    ':104000000102030405060708090A0B0C0D0E0F1028\n' +
                    ':00000001FF');
                expect(blocks.size).toBe(5);

                expect(Array.from(blocks.keys())).toEqual([0x1000, 0x2000, 0x3000, 0x4000, 0x5000]);

            });

            it('Returns two contiguous blocks when using maxBlockSize', () => {
                let blocks = intelHex.hexToArrays(
                    ':100010001112131415161718191A1B1C1D1E1F2058\n' +
                    ':100000000102030405060708090A0B0C0D0E0F1068\n' +
                    ':00000001FF', 16);
                expect(blocks.size).toBe(2);
                expect(blocks.get(0x00)).toBeDefined();
                expect(blocks.get(0x10)).toBeDefined();
            });
        });


        describe('Record wrapping', ()=>{
            it('Throws exception if record wraps over 0xFFFF, 2 bytes', () => {
                expect(()=>{
                    let blocks = intelHex.hexToArrays(
                        ':02FFFF000102FD\n' +
                        ':00000001FF');
                }).toThrow(new Error('Data at record 1 (:02FFFF000102FD) wraps over 0xFFFF. This would trigger ambiguous behaviour. Please restructure your data so that for every record the data offset plus the data length do not exceed 0xFFFF.'));
            });
            it('Throws exception if record wraps over 0xFFFF, 16 bytes', () => {
                expect(()=>{
                    let blocks = intelHex.hexToArrays(
                        ':10FFF8000102030405060708090A0B0C0D0E0F1071\n' +
                        ':00000001FF');
                }).toThrow(new Error('Data at record 1 (:10FFF8000102030405060708090A0B0C0D0E0F1071) wraps over 0xFFFF. This would trigger ambiguous behaviour. Please restructure your data so that for every record the data offset plus the data length do not exceed 0xFFFF.'));
            });

            it('Does not throw if record ends at exactly 0xFFFF, 1 byte', () => {
                let blocks = intelHex.hexToArrays(
                    ':01FFFF000100\n' +
                    ':00000001FF');
                expect(blocks.size).toBe(1);
                expect(blocks.get(0xFFFF).length).toBe(1);
            });
            it('Does not throw if record ends at exactly 0xFFFF, 16 bytes', () => {
                let blocks = intelHex.hexToArrays(
                    ':10FFF0000102030405060708090A0B0C0D0E0F1079\n' +
                    ':00000001FF');
                expect(blocks.size).toBe(1);
                expect(blocks.get(0xFFF0).length).toBe(16);
            });
        });
    });

    describe("hexToArrays", function() {

        it('Outputs EOF on empty input', () => {
            let str = intelHex.arraysToHex(new Map());
            expect(str).toBe(':00000001FF');
        });

        describe("Input sanity", function() {
            it('Outputs EOF on empty input, using a plain object instead of a Map', () => {
                let str = intelHex.arraysToHex({});
                expect(str).toBe(':00000001FF');
            });
            it('Throws error when passing a plain Uint8Array', () => {
                expect(()=>{
                    intelHex.arraysToHex(new Uint8Array([1,2,3,4]));
                }).toThrow(new Error('Input of arraysToHex is neither a Map nor a plain Object'));
            });
            it('Throws error when passing a block with negative offset', () => {
                expect(()=>{
                    intelHex.arraysToHex(new Uint8Array([1,2,3,4]));
                }).toThrow(new Error('Input of arraysToHex is neither a Map nor a plain Object'));
            });
            it('Throws error when a block is not an Uint8Array', () => {
                expect(()=>{
                    intelHex.arraysToHex(new Map([[0, 'foobar']]));
                }).toThrow(new Error('Block at offset 0 is not an Uint8Array'));
            });
        });

        describe("Basic output", function() {
            it('Outputs one offset record plus one data record on one byte', () => {
                let bytes = (new Uint8Array([1]));
                let str = intelHex.arraysToHex(new Map([[0, bytes]]));

                expect(str).toBe(
                    ':020000040000FA\n' +
                    ':0100000001FE\n' +
                    ':00000001FF');
            });
            it('Outputs one offset record plus one data record on one byte, map-less input syntax', () => {
                let bytes = (new Uint8Array([1]));
                let str = intelHex.arraysToHex({0: bytes});

                expect(str).toBe(
                    ':020000040000FA\n' +
                    ':0100000001FE\n' +
                    ':00000001FF');
            });
            it('Outputs one offset record plus one data record on 16 bytes', () => {
                let bytes = (new Uint8Array(16)).map((i,j)=>j);
                let str = intelHex.arraysToHex(new Map([[0, bytes]]));

                expect(str).toBe(
                    ':020000040000FA\n' +
                    ':10000000000102030405060708090A0B0C0D0E0F78\n' +
                    ':00000001FF');
            });
            it('Outputs one offset record plus two data records on 17 bytes', () => {
                let bytes = (new Uint8Array(17)).map((i,j)=>j);
                let str = intelHex.arraysToHex(new Map([[0, bytes]]));

                expect(str).toBe(
                    ':020000040000FA\n' +
                    ':10000000000102030405060708090A0B0C0D0E0F78\n' +
                    ':0100100010DF\n' +
                    ':00000001FF');
            });
            it('Outputs one offset record plus two data records on 32 bytes', () => {
                let bytes = (new Uint8Array(32)).map((i,j)=>j);
                let str = intelHex.arraysToHex(new Map([[0, bytes]]));

                expect(str).toBe(
                    ':020000040000FA\n' +
                    ':10000000000102030405060708090A0B0C0D0E0F78\n' +
                    ':10001000101112131415161718191A1B1C1D1E1F68\n' +
                    ':00000001FF');
            });
            it('Outputs one offset record plus three data records on 33 bytes', () => {
                let bytes = (new Uint8Array(33)).map((i,j)=>j);
                let str = intelHex.arraysToHex(new Map([[0, bytes]]));

                expect(str).toBe(
                    ':020000040000FA\n' +
                    ':10000000000102030405060708090A0B0C0D0E0F78\n' +
                    ':10001000101112131415161718191A1B1C1D1E1F68\n' +
                    ':0100200020BF\n' +
                    ':00000001FF');
            });
            it('Outputs one offset record plus three data records on 48 bytes', () => {
                let bytes = (new Uint8Array(48)).map((i,j)=>j);
                let str = intelHex.arraysToHex(new Map([[0, bytes]]));

                expect(str).toBe(
                    ':020000040000FA\n' +
                    ':10000000000102030405060708090A0B0C0D0E0F78\n' +
                    ':10001000101112131415161718191A1B1C1D1E1F68\n' +
                    ':10002000202122232425262728292A2B2C2D2E2F58\n' +
                    ':00000001FF');
            });
            it('Outputs one offset record plus 16 data records on 256 bytes', () => {
                let bytes = (new Uint8Array(256)).map((i,j)=>j);
                let str = intelHex.arraysToHex(new Map([[0, bytes]]));

                expect(str).toBe(
                    ':020000040000FA\n' +
                    ':10000000000102030405060708090A0B0C0D0E0F78\n' +
                    ':10001000101112131415161718191A1B1C1D1E1F68\n' +
                    ':10002000202122232425262728292A2B2C2D2E2F58\n' +
                    ':10003000303132333435363738393A3B3C3D3E3F48\n' +
                    ':10004000404142434445464748494A4B4C4D4E4F38\n' +
                    ':10005000505152535455565758595A5B5C5D5E5F28\n' +
                    ':10006000606162636465666768696A6B6C6D6E6F18\n' +
                    ':10007000707172737475767778797A7B7C7D7E7F08\n' +
                    ':10008000808182838485868788898A8B8C8D8E8FF8\n' +
                    ':10009000909192939495969798999A9B9C9D9E9FE8\n' +
                    ':1000A000A0A1A2A3A4A5A6A7A8A9AAABACADAEAFD8\n' +
                    ':1000B000B0B1B2B3B4B5B6B7B8B9BABBBCBDBEBFC8\n' +
                    ':1000C000C0C1C2C3C4C5C6C7C8C9CACBCCCDCECFB8\n' +
                    ':1000D000D0D1D2D3D4D5D6D7D8D9DADBDCDDDEDFA8\n' +
                    ':1000E000E0E1E2E3E4E5E6E7E8E9EAEBECEDEEEF98\n' +
                    ':1000F000F0F1F2F3F4F5F6F7F8F9FAFBFCFDFEFF88\n' +
                    ':00000001FF');
            });
        });

        describe("Custom record length", function() {
            it('Throws error when passing a negative record value', () => {
                expect(()=>{
                    intelHex.arraysToHex(new Uint8Array([1,2,3,4]), -5);
                }).toThrow(new Error('Size of record must be greater than zero'));
            });

            it('Outputs two one-byte data records on 2 bytes', () => {
                let bytes = (new Uint8Array(2)).map((i,j)=>j);
                let str = intelHex.arraysToHex(new Map([[0, bytes]]), 1);

                expect(str).toBe(
                    ':020000040000FA\n' +
                    ':0100000000FF\n' +
                    ':0100010001FD\n' +
                    ':00000001FF');
            });
            it('Outputs four four-byte data records on 16 bytes', () => {
                let bytes = (new Uint8Array(16)).map((i,j)=>j);
                let str = intelHex.arraysToHex(new Map([[0, bytes]]), 4);

                expect(str).toBe(
                    ':020000040000FA\n' +
                    ':0400000000010203F6\n' +
                    ':0400040004050607E2\n' +
                    ':0400080008090A0BCE\n' +
                    ':04000C000C0D0E0FBA\n' +
                    ':00000001FF');
            });
        });

        describe("Offset output", function() {
            it('Outputs one 16-byte record starting at 0x00009876', () => {
                let bytes = (new Uint8Array(16)).map((i,j)=>j);
                let str = intelHex.arraysToHex(new Map([[0x9876, bytes]]));

                expect(str).toBe(
                    ':020000040000FA\n' +
                    ':10987600000102030405060708090A0B0C0D0E0F6A\n' +
                    ':00000001FF');
            });

            it('Outputs one 16-byte record starting at 0x98765432', () => {
                let bytes = (new Uint8Array(16)).map((i,j)=>j);
                let str = intelHex.arraysToHex(new Map([[0x98765432, bytes]]));

                expect(str).toBe(
                    ':020000049876EC\n' +
                    ':10543200000102030405060708090A0B0C0D0E0FF2\n' +
                    ':00000001FF');
            });

            it('Throws error if data address is over 0xFFFFFFFF', () => {
                let bytes = (new Uint8Array(2));
                expect(()=>{
                    let str = intelHex.arraysToHex(new Map([[0xFFFFFFFF, bytes]]));
                }).toThrow(new Error('Data cannot be over 0xFFFFFFFF'));

            });

            it('Outputs one offset record plus 16 data records on 256 bytes at 0x00009876', () => {
                let bytes = (new Uint8Array(256)).map((i,j)=>j);
                let str = intelHex.arraysToHex(new Map([[0x9876, bytes]]));

                expect(str).toBe(
                    ':020000040000FA\n' +
                    ':10987600000102030405060708090A0B0C0D0E0F6A\n' +
                    ':10988600101112131415161718191A1B1C1D1E1F5A\n' +
                    ':10989600202122232425262728292A2B2C2D2E2F4A\n' +
                    ':1098A600303132333435363738393A3B3C3D3E3F3A\n' +
                    ':1098B600404142434445464748494A4B4C4D4E4F2A\n' +
                    ':1098C600505152535455565758595A5B5C5D5E5F1A\n' +
                    ':1098D600606162636465666768696A6B6C6D6E6F0A\n' +
                    ':1098E600707172737475767778797A7B7C7D7E7FFA\n' +
                    ':1098F600808182838485868788898A8B8C8D8E8FEA\n' +
                    ':10990600909192939495969798999A9B9C9D9E9FD9\n' +
                    ':10991600A0A1A2A3A4A5A6A7A8A9AAABACADAEAFC9\n' +
                    ':10992600B0B1B2B3B4B5B6B7B8B9BABBBCBDBEBFB9\n' +
                    ':10993600C0C1C2C3C4C5C6C7C8C9CACBCCCDCECFA9\n' +
                    ':10994600D0D1D2D3D4D5D6D7D8D9DADBDCDDDEDF99\n' +
                    ':10995600E0E1E2E3E4E5E6E7E8E9EAEBECEDEEEF89\n' +
                    ':10996600F0F1F2F3F4F5F6F7F8F9FAFBFCFDFEFF79\n' +
                    ':00000001FF');
            });

            it('Outputs two 1-byte records starting at 0x0000FFFF from 2 bytes, including extra offset record', () => {
                let bytes = (new Uint8Array(2)).map((i,j)=>j);
                let str = intelHex.arraysToHex(new Map([[0xFFFF, bytes]]));

                expect(str).toBe(
                    ':020000040000FA\n' +
                    ':01FFFF000001\n' +
                    ':020000040001F9\n' +
                    ':0100000001FE\n' +
                    ':00000001FF');
            });

            it('Outputs two 8-byte records starting at 0x0000FFF8 from 16 bytes, including extra offset record', () => {
                let bytes = (new Uint8Array(16)).map((i,j)=>j);
                let str = intelHex.arraysToHex(new Map([[0xFFF8, bytes]]));

                expect(str).toBe(
                    ':020000040000FA\n' +
                    ':08FFF8000001020304050607E5\n' +
                    ':020000040001F9\n' +
                    ':0800000008090A0B0C0D0E0F9C\n' +
                    ':00000001FF');
            });

            it('Splits custom-sized records at 0x0000FFF9', () => {
                let bytes = (new Uint8Array(15)).map((i,j)=>j);
                let str = intelHex.arraysToHex(new Map([[0xFFF9, bytes]]), 5);

                expect(str).toBe(
                    ':020000040000FA\n' +
                    ':05FFF9000001020304F9\n' +
                    ':02FFFE000506F6\n' +
                    ':020000040001F9\n' +
                    ':050000000708090A0BCE\n' +
                    ':030005000C0D0ED1\n' +
                    ':00000001FF');
            });

            it('Outputs two 1-byte records starting at 0x9876FFFF from 2 bytes, including extra offset record', () => {
                let bytes = (new Uint8Array(2)).map((i,j)=>j);
                let str = intelHex.arraysToHex(new Map([[0xFFFF, bytes]]));

                expect(str).toBe(
                    ':020000040000FA\n' +
                    ':01FFFF000001\n' +
                    ':020000040001F9\n' +
                    ':0100000001FE\n' +
                    ':00000001FF');
            });

            it('Outputs two 8-byte records starting at 0x9876FFF8 from 16 bytes, including extra offset record', () => {
                let bytes = (new Uint8Array(16)).map((i,j)=>j);
                let str = intelHex.arraysToHex(new Map([[0xFFF8, bytes]]));

                expect(str).toBe(
                    ':020000040000FA\n' +
                    ':08FFF8000001020304050607E5\n' +
                    ':020000040001F9\n' +
                    ':0800000008090A0B0C0D0E0F9C\n' +
                    ':00000001FF');
            });

            it('Splits custom-sized records at 0x9876FFF9', () => {
                let bytes = (new Uint8Array(15)).map((i,j)=>j);
                let str = intelHex.arraysToHex(new Map([[0xFFF9, bytes]]), 5);

                expect(str).toBe(
                    ':020000040000FA\n' +
                    ':05FFF9000001020304F9\n' +
                    ':02FFFE000506F6\n' +
                    ':020000040001F9\n' +
                    ':050000000708090A0BCE\n' +
                    ':030005000C0D0ED1\n' +
                    ':00000001FF');
            });
        });


        describe("Multiple input", function() {
            it('Outputs two records for 2 consecutive blocks', () => {
                let bytes1 = (new Uint8Array(16)).map((i,j)=>j);
                let bytes2 = (new Uint8Array(16)).map((i,j)=>j+16);
                let str = intelHex.arraysToHex(new Map([
                    [0x00, bytes1],
                    [0x10, bytes2]
                ]));

                expect(str).toBe(
                    ':020000040000FA\n' +
                    ':10000000000102030405060708090A0B0C0D0E0F78\n' +
                    ':10001000101112131415161718191A1B1C1D1E1F68\n' +
                    ':00000001FF');
            });

            it('Outputs no extra offset records for 2 consecutive blocks in the same segment', () => {
                let bytes1 = (new Uint8Array(16)).map((i,j)=>j);
                let bytes2 = (new Uint8Array(16)).map((i,j)=>j+16);
                let str = intelHex.arraysToHex(new Map([
                    [0x0000, bytes1],
                    [0x0800, bytes2]
                ]));

                expect(str).toBe(
                    ':020000040000FA\n' +
                    ':10000000000102030405060708090A0B0C0D0E0F78\n' +
                    ':10080000101112131415161718191A1B1C1D1E1F70\n' +
                    ':00000001FF');
            });

            it('Outputs extra offset records for 2 consecutive key-value pairs in the same segment', () => {
                let bytes1 = (new Uint8Array(16)).map((i,j)=>j);
                let bytes2 = (new Uint8Array(16)).map((i,j)=>j+16);
                let str = intelHex.arraysToHex(new Map([
                    [0x000000, bytes1],
                    [0x050010, bytes2]
                ]));

                expect(str).toBe(
                    ':020000040000FA\n' +
                    ':10000000000102030405060708090A0B0C0D0E0F78\n' +
                    ':020000040005F5\n' +
                    ':10001000101112131415161718191A1B1C1D1E1F68\n' +
                    ':00000001FF');
            });

            it('4 individual blocks in 2 segments', () => {
                let bytes1 = (new Uint8Array(16)).map((i,j)=>j);
                let bytes2 = (new Uint8Array(16)).map((i,j)=>j+16);
                let bytes3 = (new Uint8Array(16)).map((i,j)=>j+32);
                let bytes4 = (new Uint8Array(16)).map((i,j)=>j+48);
                let str = intelHex.arraysToHex(new Map([
                    [0x000000, bytes1],
                    [0x000800, bytes2],
                    [0x050010, bytes3],
                    [0x050C30, bytes4]
                ]));

                expect(str).toBe(
                    ':020000040000FA\n' +
                    ':10000000000102030405060708090A0B0C0D0E0F78\n' +
                    ':10080000101112131415161718191A1B1C1D1E1F70\n' +
                    ':020000040005F5\n' +
                    ':10001000202122232425262728292A2B2C2D2E2F68\n' +
                    ':100C3000303132333435363738393A3B3C3D3E3F3C\n' +
                    ':00000001FF');
            });

            it('Sorts blocks in ascendent address order', () => {
                let bytes1 = (new Uint8Array(16)).map((i,j)=>j);
                let bytes2 = (new Uint8Array(16)).map((i,j)=>j+16);
                let bytes3 = (new Uint8Array(16)).map((i,j)=>j+32);
                let bytes4 = (new Uint8Array(16)).map((i,j)=>j+48);
                let str = intelHex.arraysToHex(new Map([
                    [0x050010, bytes3],
                    [0x000000, bytes1],
                    [0x050C30, bytes4],
                    [0x000800, bytes2]
                ]));

                expect(str).toBe(
                    ':020000040000FA\n' +
                    ':10000000000102030405060708090A0B0C0D0E0F78\n' +
                    ':10080000101112131415161718191A1B1C1D1E1F70\n' +
                    ':020000040005F5\n' +
                    ':10001000202122232425262728292A2B2C2D2E2F68\n' +
                    ':100C3000303132333435363738393A3B3C3D3E3F3C\n' +
                    ':00000001FF');
            });

            it('Ignores empty blocks', () => {
                let bytes1 = (new Uint8Array(16)).map((i,j)=>j);
                let bytes2 = (new Uint8Array(16)).map((i,j)=>j+16);
                let bytes3 = (new Uint8Array(16)).map((i,j)=>j+32);
                let bytes4 = (new Uint8Array(16)).map((i,j)=>j+48);
                let str = intelHex.arraysToHex(new Map([
                    [0x050010, bytes3],
                    [0x050020, new Uint8Array(0)],
                    [0x000000, bytes1],
                    [0x000008, new Uint8Array(0)],
                    [0x000010, new Uint8Array(0)],
                    [0x00000C, new Uint8Array(0)],
                    [0x050E30, new Uint8Array(0)],
                    [0x050C30, bytes4],
                    [0x050D30, new Uint8Array(0)],
                    [0x000800, bytes2]
                ]));

                expect(str).toBe(
                    ':020000040000FA\n' +
                    ':10000000000102030405060708090A0B0C0D0E0F78\n' +
                    ':10080000101112131415161718191A1B1C1D1E1F70\n' +
                    ':020000040005F5\n' +
                    ':10001000202122232425262728292A2B2C2D2E2F68\n' +
                    ':100C3000303132333435363738393A3B3C3D3E3F3C\n' +
                    ':00000001FF');
            });

            it('Ignores empty blocks, map-less input syntax', () => {
                let bytes1 = (new Uint8Array(16)).map((i,j)=>j);
                let bytes2 = (new Uint8Array(16)).map((i,j)=>j+16);
                let bytes3 = (new Uint8Array(16)).map((i,j)=>j+32);
                let bytes4 = (new Uint8Array(16)).map((i,j)=>j+48);
                let str = intelHex.arraysToHex({
                    0x050010: bytes3,
                    0x050020: new Uint8Array(0),
                    0x000000: bytes1,
                    0x000008: new Uint8Array(0),
                    0x000010: new Uint8Array(0),
                    0x00000C: new Uint8Array(0),
                    0x050E30: new Uint8Array(0),
                    0x050C30: bytes4,
                    0x050D30: new Uint8Array(0),
                    0x000800: bytes2
                });

                expect(str).toBe(
                    ':020000040000FA\n' +
                    ':10000000000102030405060708090A0B0C0D0E0F78\n' +
                    ':10080000101112131415161718191A1B1C1D1E1F70\n' +
                    ':020000040005F5\n' +
                    ':10001000202122232425262728292A2B2C2D2E2F68\n' +
                    ':100C3000303132333435363738393A3B3C3D3E3F3C\n' +
                    ':00000001FF');
            });

            it('Throws error on overlapping blocks', () => {
                let bytes1 = (new Uint8Array(16)).map((i,j)=>j);
                let bytes2 = (new Uint8Array(16)).map((i,j)=>j+16);
                expect(()=>{
                    intelHex.arraysToHex(new Map([
                        [0x000000, bytes1],
                        [0x000008, bytes2]
                    ]));
                }).toThrow(new Error('Block starting at 0x8 overlaps with a previous block.'));

            });
        });
    });

    describe("hexToArrays+arraysToHex idempotence", function() {
        it('8 consecutive 16-byte records', () => {
            let str = ':020000040001F9\n' +
                ':10C00000C039002049C1010063C1010065C10100C0\n' +
                ':10C010000000000000000000000000000000000020\n' +
                ':10C0200000000000000000000000000067C10100E7\n' +
                ':10C03000000000000000000069C101006BC10100A8\n' +
                ':10C040006DC101006DC10100DDC401006DC10100C1\n' +
                ':10C050006DC101000000000099C201006DC1010026\n' +
                ':10C060006DC101006DC101006DC101006DC1010014\n' +
                ':10C070006DC101006DC101006DC101006DC1010004\n' +
                ':00000001FF';

            expect(intelHex.arraysToHex(intelHex.hexToArrays(str))).toBe(str);
        });
    });

    describe("arraysToHex+hexToArrays idempotence", function() {
        it('keeps 256B', () => {
            let bytes = (new Uint8Array(0x100)).map((i,j)=>j);
            let blocks = new Map([[0, bytes]]);

            expect(intelHex.hexToArrays(intelHex.arraysToHex(blocks))).toEqual(blocks);
        });
        it('keeps 64KiB', () => {
            let bytes = (new Uint8Array(0x10000)).map((i,j)=>j);
            let blocks = new Map([[0, bytes]]);

            expect(intelHex.hexToArrays(intelHex.arraysToHex(blocks))).toEqual(blocks);
        });
        it('keeps 1MiB', () => {
            let bytes = (new Uint8Array(0x100000)).map((i,j)=>j);
            let blocks = new Map([[0, bytes]]);

            expect(intelHex.hexToArrays(intelHex.arraysToHex(blocks))).toEqual(blocks);
        });
    });


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
});
