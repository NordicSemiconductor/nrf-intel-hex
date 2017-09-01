
// Parser / writer for the "Intel hex" format
// Format specifications at:
// https://en.wikipedia.org/wiki/Intel_HEX
// http://microsym.com/editor/assets/intelhex.pdf

/*
 * A regexp that matches lines in a .hex file.
 *
 * One hexadecimal character is matched by "[0-9A-Fa-f]".
 * Two hex characters are matched by "[0-9A-Fa-f]{2}"
 * Eight or more hex characters are matched by "[0-9A-Fa-f]{8,}"
 * A capture group of two hex characters is "([0-9A-Fa-f]{2})"
 *
 * Record mark         :
 * 8 or more hex chars  ([0-9A-Fa-f]{8,})
 * Checksum                              ([0-9A-Fa-f]{2})
 * Optional newline                                      (?:\r\n|\r|\n)?
 */
const hexLineRegexp = /:([0-9A-Fa-f]{8,})([0-9A-Fa-f]{2})(?:\r\n|\r|\n|)/g;


// Takes a Uint8Array as input,
// Returns an integer in the 0-255 range.
function checksum(bytes) {
    return (-bytes.reduce((sum, v)=>sum + v, 0)) & 0xFF;
}

// Takes two Uint8Arrays as input,
// Returns an integer in the 0-255 range.
function checksumTwo(array1, array2) {
    let partial1 = array1.reduce((sum, v)=>sum + v, 0);
    let partial2 = array2.reduce((sum, v)=>sum + v, 0);
    return -( partial1 + partial2 ) & 0xFF;
}


// Takes a Map of address→Uint8Arrays
// Returns a Map of address→Uint8Arrays
// The insertion order of the returned map is guaranteed to
// be ascending
// Concatenates the blocks if possible, up to maxBlockSize
function mergeBlocks(blocks, maxBlockSize = Infinity) {

    // First pass, create a Map of address→length of contiguous blocks
    let sortedKeys = Array.from(blocks.keys()).sort((a,b)=>a-b);
    let blockSizes = new Map();
    let lastBlockAddr = -1;
    let lastBlockEndAddr = -1;

    for (let i=0,l=sortedKeys.length; i<l; i++) {
        const blockAddr = sortedKeys[i];
        const blockLength = blocks.get(sortedKeys[i]).length;

        if (lastBlockEndAddr === blockAddr && (lastBlockEndAddr - lastBlockAddr) < maxBlockSize) {
            // Grow when the previous end address equals the current,
            // and we don't go over the maximum block size.
            blockSizes.set(lastBlockAddr, blockSizes.get(lastBlockAddr) + blockLength);
            lastBlockEndAddr += blockLength;
        } else if (lastBlockEndAddr <= blockAddr) {
            // Else mark a new block.
            blockSizes.set(blockAddr, blockLength);
            lastBlockAddr = blockAddr;
            lastBlockEndAddr = blockAddr + blockLength;
        } else {
            throw new Error('Overlapping data around address 0x' + blockAddr.toString(16));
        }
    }

    // Second pass: allocate memory for the contiguous blocks and copy data around.
    let mergedBlocks = new Map();
    let mergingBlock;
    let mergingBlockAddr = -1;
    for (let i=0,l=sortedKeys.length; i<l; i++) {
        const blockAddr = sortedKeys[i];
        if (blockSizes.has(blockAddr)) {
            mergingBlock = new Uint8Array(blockSizes.get(blockAddr));
            mergedBlocks.set(blockAddr, mergingBlock);
            mergingBlockAddr = blockAddr;
        }
        mergingBlock.set(blocks.get(blockAddr), blockAddr - mergingBlockAddr);
    };

    return mergedBlocks;
}


// Takes a string as input,
// Returns an Map of address→Uint8Arrays.
// The insertion order of the returned map is guaranteed to
// be ascending
// Concatenates the blocks if possible, up to maxBlockSize
// If maxBlockSize is given, then the maximum size of each Uint8Array will be that.
function hexToArrays(hexText, maxBlockSize = Infinity, strict = true) {
    let blocks = new Map();

    let lastCharacterParsed = 0;
    let matchResult;
    let recordCount = 0;

    // Upper Linear Base Address, the 16 most significant bits (1 bytes) of
    // the current 32-bit (4-byte) address
    // In practice this is a offset that is summed to the "load offset" of the
    // data records
    let ulba = 0;

    hexLineRegexp.lastIndex = 0; // Reset the regexp, if not it would skip content when called twice

    while ((matchResult = hexLineRegexp.exec(hexText)) !== null) {
        recordCount++;

        // By default, a regexp loop ignores gaps between matches, but
        // we want to be aware of them.
        if (strict && lastCharacterParsed !== matchResult.index) {
            throw new Error(
                'Malformed hex file: Could nor parse between characters ' +
                lastCharacterParsed +
                ' and ' +
                matchResult.index +
                ' ("' +
                hexText.substring(lastCharacterParsed, Math.min(matchResult.index, lastCharacterParsed + 16)).trim() +
                '")');
        }
        lastCharacterParsed = hexLineRegexp.lastIndex;

        // Give pretty names to the match's capture groups
        const [undefined, recordStr, recordChecksum] = matchResult;

        // String to Uint8Array - https://stackoverflow.com/questions/43131242/how-to-convert-a-hexademical-string-of-data-to-an-arraybuffer-in-javascript
        const recordBytes = new Uint8Array(recordStr.match(/[\da-f]{2}/gi).map((h)=>parseInt(h, 16)));

        const recordLength = recordBytes[0];
        if (recordLength + 4 !== recordBytes.length) {
            throw new Error('Mismatched record length at record ' + recordCount + ' (' + matchResult[0].trim() + '), expected ' + (recordLength) + ' data bytes but actual length is ' + (recordBytes.length - 4));
        }

        const cs = checksum(recordBytes);
        if (parseInt(recordChecksum, 16) !== cs) {
            throw new Error('Checksum failed at record ' + recordCount + ' (' + matchResult[0].trim() + '), should be ' + cs.toString(16) );
        }

        const offset = (recordBytes[1] << 8) + recordBytes[2];
        const recordType = recordBytes[3];
        let data = recordBytes.subarray(4);

        if (recordType === 0) {
            // Data record, contains data
            // Create a new block, at (upper linear base address + offset)
            if (blocks.has(ulba + offset)) {
                throw new Error('Duplicated data at record ' + recordCount + ' (' + matchResult[0].trim() + ')');
            }
            if (offset + data.length > 0x10000) {
                throw new Error(
                    'Data at record ' +
                    recordCount +
                    ' (' +
                    matchResult[0].trim() +
                    ') wraps over 0xFFFF. This would trigger ambiguous behaviour. Please restructure your data so that for every record the data offset plus the data length do not exceed 0xFFFF.');
            }

            blocks.set( ulba + offset, data );

        } else {

            // All non-data records must have a data offset of zero
            if (offset !== 0) {
                throw new Error('Record ' + recordCount + ' (' + matchResult[0].trim() + ') must have 0000 as data offset.');
            }

            switch (recordType) {
                case 1: // EOF
                    if (lastCharacterParsed !== hexText.length) {
                        // This record should be at the very end of the string
                        throw new Error('There is data after an EOF record at record ' + recordCount);
                    }

                    return mergeBlocks(blocks, maxBlockSize);
                    break;

                case 2: // Extended Segment Address Record
                    // Sets the 16 most significant bits of the 20-bit Segment Base
                    // Address for the subsequent data.
                    ulba = ((data[0] << 8) + data[1]) << 4;
                    break;

                case 3: // Start Segment Address Record
                    // Do nothing. Record type 3 only applies to 16-bit Intel CPUs,
                    // where it should reset the program counter (CS+IP CPU registers)
                    break;

                case 4: // Extended Linear Address Record
                    // Sets the 16 most significant (upper) bits of the 32-bit Linear Address
                    // for the subsequent data
                    ulba = ((data[0] << 8) + data[1]) << 16;
                    break;

                case 5: // Start Linear Address Record
                    // Do nothing. Record type 5 only applies to 32-bit Intel CPUs,
                    // where it should reset the program counter (EIP CPU register)
                    // It might have meaning for other CPU architectures
                    // (see http://infocenter.arm.com/help/index.jsp?topic=/com.arm.doc.faqs/ka9903.html )
                    // bit will be ignored nonetheless.
                    break;
            }
        }
    }

    if (recordCount) {
        throw new Error('No EOF record at end of file');
    } else {
        throw new Error('Malformed .hex file, could not parse any registers');
    }
}


// Trivial utility. Converts a number to hex and pads with zeroes up to 2 characters.
function hexpad(number) {
    return number.toString(16).toUpperCase().padStart(2, '0');
}


// Takes a iterable of address→Uint8Array, and returns a string of text
// This is the opposite of hexToArrays
function arraysToHex(blocks, lineSize = 16) {
    let lowAddress  = 0;    // 16 least significant bits of the current addr
    let highAddress = -1 << 16; // 16 most significant bits of the current addr
    let records = [];
    if (lineSize <=0) {
        throw new Error('Size of record must be greater than zero');
    }

    if (!(blocks instanceof Map)) {
        // Cast the blocks into a map if possible. Namely, when blocks is a plain Object
        // being used as a dictionary with only integer numeric keys
        if (blocks != null && blocks.__proto__ === Object.prototype){
            if (Object.keys(blocks).every((key=>parseInt(key).toString() === key))) {
                blocks = new Map(Object.entries(blocks).map(entry=>[parseInt(entry[0]), entry[1]]));
            } else {
                throw new Error('Input of arraysToHex is an Object but it contains non-numeric keys');
            }
        } else {
            throw new Error('Input of arraysToHex is neither a Map nor a plain Object');
        }
    }

    // Placeholders
    let offsetRecord = new Uint8Array(6);
    let recordHeader = new Uint8Array(4);

    let sortedKeys = Array.from(blocks.keys()).sort((a,b)=>a-b);
    for (let i=0,l=sortedKeys.length; i<l; i++) {
        let blockAddr = sortedKeys[i];
        let block = blocks.get(blockAddr);

        // Sanity checks
        if (!(block instanceof Uint8Array)) {
            throw new Error('Block at offset ' + blockAddr + ' is not an Uint8Array');
        }
        if (blockAddr < 0) {
            throw new Error('Block at offset ' + blockAddr + ' has a negative thus invalid address');
        }
        let blockSize = block.length;
        if (!blockSize) { continue; }   // Skip zero-lenght blocks


        if (blockAddr > (highAddress + 0xFFFF)) {
            // Insert a new 0x04 record to jump to a new 64KiB block

            // Round up the least significant 16 bits - no bitmasks because they trigger
            // base-2 negative numbers, whereas subtracting the modulo maintains precision
            highAddress = blockAddr - blockAddr % 0x10000;
            lowAddress = 0;

            offsetRecord[0] = 2;    // Length
            offsetRecord[1] = 0;    // Load offset, high byte
            offsetRecord[2] = 0;    // Load offset, low byte
            offsetRecord[3] = 4;    // Record type
            offsetRecord[4] = highAddress >> 24;    // new address offset, high byte
            offsetRecord[5] = highAddress >> 16;    // new address offset, low byte

            records.push(
                ':' +
                Array.prototype.map.call(offsetRecord, hexpad).join('') +
                hexpad(checksum(offsetRecord))
            );
        }

        if (blockAddr < (highAddress + lowAddress)) {
            throw new Error(
                'Block starting at 0x' +
                blockAddr.toString(16) +
                ' overlaps with a previous block.');
        }

        lowAddress = blockAddr % 0x10000;
        let blockOffset = 0;
        let blockEnd = blockAddr + blockSize;
        if (blockEnd > 0xFFFFFFFF) {
            throw new Error('Data cannot be over 0xFFFFFFFF');
        }

        // Loop for every 64KiB memory segment that spans this block
        while (highAddress + lowAddress < blockEnd) {

            if (lowAddress > 0xFFFF) {
                // Insert a new 0x04 record to jump to a new 64KiB block
                highAddress += 1 << 16; // Increase by one
                lowAddress = 0;

                offsetRecord[0] = 2;    // Length
                offsetRecord[1] = 0;    // Load offset, high byte
                offsetRecord[2] = 0;    // Load offset, low byte
                offsetRecord[3] = 4;    // Record type
                offsetRecord[4] = highAddress >> 24;    // new address offset, high byte
                offsetRecord[5] = highAddress >> 16;    // new address offset, low byte

                records.push(
                    ':' +
                    Array.prototype.map.call(offsetRecord, hexpad).join('') +
                    hexpad(checksum(offsetRecord))
                );
            }

            let recordSize = -1;
            // Loop for every record for that spans the current 64KiB memory segment
            while (lowAddress < 0x10000 && recordSize) {
                recordSize = Math.min(
                    lineSize,                            // Normal case
                    blockEnd - highAddress - lowAddress, // End of block
                    0x10000 - lowAddress,                // End of low addresses
                    255                                  // Maximum record legnth as per spec
                );

                if (recordSize) {

//     console.log('high 0x'+ hexpad(highAddress), 'low 0x'+ hexpad(lowAddress), 'size ' + recordSize);

                    recordHeader[0] = recordSize;   // Length
                    recordHeader[1] = lowAddress >> 8;    // Load offset, high byte
                    recordHeader[2] = lowAddress;    // Load offset, low byte
                    recordHeader[3] = 0;    // Record type

                    let subBlock = block.subarray(blockOffset, blockOffset + recordSize);   // Data bytes for this record

                    records.push(
                        ':' +
                        Array.prototype.map.call(recordHeader, hexpad).join('') +
                        Array.prototype.map.call(subBlock, hexpad).join('') +
                        hexpad(checksumTwo(recordHeader, subBlock))
                    );

                    blockOffset += recordSize;
                    lowAddress += recordSize;
                    // FIXME: insert 0x00 data record, increase lowAddress
                }
            }
        }
    }

    records.push(":00000001FF");    // EOF record

    return records.join('\n');
}








module.exports = {
    hexToArrays: hexToArrays,
    arraysToHex: arraysToHex
};
