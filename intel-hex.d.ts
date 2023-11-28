export type MemoryBlocks =
  | Iterable<[number, Uint8Array]>
  | {[addr: number]: Uint8Array}
  | undefined
  | null;

export type Overlap<T> = [T, Uint8Array][];
export type Overlaps<T> = Map<number, Overlap<T>>;
export type MemoryMapTuple<T> = [T, MemoryMap];
export type MemoryMaps<T> = MemoryMapTuple<T>[];

declare class MemoryMap extends Map<number, Uint8Array> {
  /**
   * @param {MemoryBlocks} blocks The initial value for the memory blocks inside this
   * <tt>MemoryMap</tt>. All keys must be numeric, and all values must be instances of
   * <tt>Uint8Array</tt>. Optionally it can also be a plain <tt>Object</tt> with
   * only numeric keys.
   */
  constructor(blocks?: MemoryBlocks);

  /**
   * Parses a string containing data formatted in "Intel HEX" format, and
   * returns an instance of {@linkcode MemoryMap}.
   *<br/>
   * The insertion order of keys in the {@linkcode MemoryMap} is guaranteed to be strictly
   * ascending. In other words, when iterating through the {@linkcode MemoryMap}, the addresses
   * will be ordered in ascending order.
   *<br/>
   * The parser has an opinionated behaviour, and will throw a descriptive error if it
   * encounters some malformed input. Check the project's
   * {@link https://github.com/NordicSemiconductor/nrf-intel-hex#Features|README file} for details.
   *<br/>
   * If <tt>maxBlockSize</tt> is given, any contiguous data block larger than that will
   * be split in several blocks.
   *
   * @param {String} hexText The contents of a .hex file.
   * @param {Number} [maxBlockSize=Infinity] Maximum size of the returned <tt>Uint8Array</tt>s.
   *
   * @return {MemoryMap}
   *
   * @example
   * import MemoryMap from 'nrf-intel-hex';
   *
   * let intelHexString =
   *     ":100000000102030405060708090A0B0C0D0E0F1068\n" +
   *     ":00000001FF";
   *
   * let memMap = MemoryMap.fromHex(intelHexString);
   *
   * for (let [address, dataBlock] of memMap) {
   *     console.log('Data block at ', address, ', bytes: ', dataBlock);
   * }
   */
  static fromHex(hexText: string, maxBlockSize?: number): MemoryMap;

  /**
   * Returns a <strong>new</strong> instance of {@linkcode MemoryMap}, containing
   * the same data, but concatenating together those memory blocks that are adjacent.
   *<br/>
   * The insertion order of keys in the {@linkcode MemoryMap} is guaranteed to be strictly
   * ascending. In other words, when iterating through the {@linkcode MemoryMap}, the addresses
   * will be ordered in ascending order.
   *<br/>
   * If <tt>maxBlockSize</tt> is given, blocks will be concatenated together only
   * until the joined block reaches this size in bytes. This means that the output
   * {@linkcode MemoryMap} might have more entries than the input one.
   *<br/>
   * If there is any overlap between blocks, an error will be thrown.
   *<br/>
   * The returned {@linkcode MemoryMap} will use newly allocated memory.
   *
   * @param {Number} [maxBlockSize=Infinity] Maximum size of the <tt>Uint8Array</tt>s in the
   * returned {@linkcode MemoryMap}.
   *
   * @return {MemoryMap}
   */
  join(maxBlockSize?: number): MemoryMap;

  /**
   * Given a {@link https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Map|<tt>Map</tt>}
   * of {@linkcode MemoryMap}s, indexed by a alphanumeric ID,
   * returns a <tt>Map</tt> of address to tuples (<tt>Arrays</tt>s of length 2) of the form
   * <tt>(id, Uint8Array)</tt>s.
   *<br/>
   * The scenario for using this is having several {@linkcode MemoryMap}s, from several calls to
   * {@link module:nrf-intel-hex~hexToArrays|hexToArrays}, each having a different identifier.
   * This function locates where those memory block sets overlap, and returns a <tt>Map</tt>
   * containing addresses as keys, and arrays as values. Each array will contain 1 or more
   * <tt>(id, Uint8Array)</tt> tuples: the identifier of the memory block set that has
   * data in that region, and the data itself. When memory block sets overlap, there will
   * be more than one tuple.
   *<br/>
   * The <tt>Uint8Array</tt>s in the output are
   * {@link https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/subarray|subarrays}
   * of the input data; new memory is <strong>not</strong> allocated for them.
   *<br/>
   * The insertion order of keys in the output <tt>Map</tt> is guaranteed to be strictly
   * ascending. In other words, when iterating through the <tt>Map</tt>, the addresses
   * will be ordered in ascending order.
   *<br/>
   * When two blocks overlap, the corresponding array of tuples will have the tuples ordered
   * in the insertion order of the input <tt>Map</tt> of block sets.
   *<br/>
   *
   * @param {Map.MemoryMap} memoryMaps The input memory block sets
   *
   * @example
   * import MemoryMap from 'nrf-intel-hex';
   *
   * let memMap1 = MemoryMap.fromHex( hexdata1 );
   * let memMap2 = MemoryMap.fromHex( hexdata2 );
   * let memMap3 = MemoryMap.fromHex( hexdata3 );
   *
   * let maps = new Map([
   *  ['file A', blocks1],
   *  ['file B', blocks2],
   *  ['file C', blocks3]
   * ]);
   *
   * let overlappings = MemoryMap.overlapMemoryMaps(maps);
   *
   * for (let [address, tuples] of overlappings) {
   *     // if 'tuples' has length > 1, there is an overlap starting at 'address'
   *
   *     for (let [address, tuples] of overlappings) {
   *         let [id, bytes] = tuple;
   *         // 'id' in this example is either 'file A', 'file B' or 'file C'
   *     }
   * }
   * @return {Map.Array<mixed,Uint8Array>} The map of possibly overlapping memory blocks
   */
  static overlapMemoryMaps<T = unknown>(memoryMaps: MemoryMaps<T>): Overlaps<T>;

  /**
   * Given the output of the {@linkcode MemoryMap.overlapMemoryMaps|overlapMemoryMaps}
   * (a <tt>Map</tt> of address to an <tt>Array</tt> of <tt>(id, Uint8Array)</tt> tuples),
   * returns a {@linkcode MemoryMap}. This discards the IDs in the process.
   *<br/>
   * The output <tt>Map</tt> contains as many entries as the input one (using the same addresses
   * as keys), but the value for each entry will be the <tt>Uint8Array</tt> of the <b>last</b>
   * tuple for each address in the input data.
   *<br/>
   * The scenario is wanting to join together several parsed .hex files, not worrying about
   * their overlaps.
   *<br/>
   *
   * @param {Map.Array<mixed,Uint8Array>} overlaps The (possibly overlapping) input memory blocks
   * @return {MemoryMap} The flattened memory blocks
   */
  static flattenOverlaps<T = unknown>(overlaps: Overlaps<T>): MemoryMap;

  /**
   * Returns a new instance of {@linkcode MemoryMap}, where:
   *
   * <ul>
   *  <li>Each key (the start address of each <tt>Uint8Array</tt>) is a multiple of
   *    <tt>pageSize</tt></li>
   *  <li>The size of each <tt>Uint8Array</tt> is exactly <tt>pageSize</tt></li>
   *  <li>Bytes from the input map to bytes in the output</li>
   *  <li>Bytes not in the input are replaced by a padding value</li>
   * </ul>
   *<br/>
   * The scenario is wanting to prepare pages of bytes for a write operation, where the write
   * operation affects a whole page/sector at once.
   *<br/>
   * The insertion order of keys in the output {@linkcode MemoryMap} is guaranteed
   * to be strictly ascending. In other words, when iterating through the
   * {@linkcode MemoryMap}, the addresses will be ordered in ascending order.
   *<br/>
   * The <tt>Uint8Array</tt>s in the output will be newly allocated.
   *<br/>
   *
   * @param {Number} [pageSize=1024] The size of the output pages, in bytes
   * @param {Number} [pad=0xFF] The byte value to use for padding
   * @return {MemoryMap}
   */
  paginate(pageSize?: number, pad?: number): MemoryMap;

  /**
   * Locates the <tt>Uint8Array</tt> which contains the given offset,
   * and returns the four bytes held at that offset, as a 32-bit unsigned integer.
   *
   *<br/>
   * Behaviour is similar to {@linkcode https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView/getUint32|DataView.prototype.getUint32},
   * except that this operates over a {@linkcode MemoryMap} instead of
   * over an <tt>ArrayBuffer</tt>, and that this may return <tt>undefined</tt> if
   * the address is not <em>entirely</em> contained within one of the <tt>Uint8Array</tt>s.
   *<br/>
   *
   * @param {Number} offset The memory offset to read the data
   * @param {Boolean} [littleEndian=false] Whether to fetch the 4 bytes as a little- or big-endian integer
   * @return {Number|undefined} An unsigned 32-bit integer number
   */
  getUint32(
    offset: number,
    littleEndian?: boolean
  ): number | undefined;

  /**
   * Returns a <tt>String</tt> of text representing a .hex file.
   * <br/>
   * The writer has an opinionated behaviour. Check the project's
   * {@link https://github.com/NordicSemiconductor/nrf-intel-hex#Features|README file} for details.
   *
   * @param {Number} [lineSize=16] Maximum number of bytes to be encoded in each data record.
   * Must have a value between 1 and 255, as per the specification.
   *
   * @return {String} String of text with the .hex representation of the input binary data
   *
   * @example
   * import MemoryMap from 'nrf-intel-hex';
   *
   * let memMap = new MemoryMap();
   * let bytes = new Uint8Array(....);
   * memMap.set(0x0FF80000, bytes); // The block with 'bytes' will start at offset 0x0FF80000
   *
   * let string = memMap.asHexString();
   */
  asHexString(lineSize?: number): string;

  /**
   * Performs a deep copy of the current {@linkcode MemoryMap}, returning a new one
   * with exactly the same contents, but allocating new memory for each of its
   * <tt>Uint8Array</tt>s.
   *
   * @return {MemoryMap}
   */
  clone(): MemoryMap;

  /**
   * Given one <tt>Uint8Array</tt>, looks through its contents and returns a new
   * {@linkcode MemoryMap}, stripping away those regions where there are only
   * padding bytes.
   * <br/>
   * The start of the input <tt>Uint8Array</tt> is assumed to be offset zero for the output.
   * <br/>
   * The use case here is dumping memory from a working device and try to see the
   * "interesting" memory regions it has. This assumes that there is a constant,
   * predefined padding byte value being used in the "non-interesting" regions.
   * In other words: this will work as long as the dump comes from a flash memory
   * which has been previously erased (thus <tt>0xFF</tt>s for padding), or from a
   * previously blanked HDD (thus <tt>0x00</tt>s for padding).
   * <br/>
   * This method uses <tt>subarray</tt> on the input data, and thus does not allocate memory
   * for the <tt>Uint8Array</tt>s.
   *
   * @param {Uint8Array} bytes The input data
   * @param {Number} [padByte=0xFF] The value of the byte assumed to be used as padding
   * @param {Number} [minPadLength=64] The minimum number of consecutive pad bytes to
   * be considered actual padding
   *
   * @return {MemoryMap}
   */
  static fromPaddedUint8Array(
    bytes: Uint8Array,
    padByte?: number,
    minPadLength?: number
  ): MemoryMap;

  /**
   * Returns a new instance of {@linkcode MemoryMap}, containing only data between
   * the addresses <tt>address</tt> and <tt>address + length</tt>.
   * Behavior is similar to {@linkcode https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/slice|Array.prototype.slice},
   * in that the return value is a portion of the current {@linkcode MemoryMap}.
   *
   * <br/>
   * The returned {@linkcode MemoryMap} might be empty.
   *
   * <br/>
   * Internally, this uses <tt>subarray</tt>, so new memory is not allocated.
   *
   * @param {Number} address The start address of the slice
   * @param {Number} length The length of memory map to slice out
   * @return {MemoryMap}
   */
  slice(address: number, length?: number): MemoryMap;

  /**
   * Returns a new instance of {@linkcode https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView/getUint32|Uint8Array}, containing only data between
   * the addresses <tt>address</tt> and <tt>address + length</tt>. Any byte without a value
   * in the input {@linkcode MemoryMap} will have a value of <tt>padByte</tt>.
   *
   * <br/>
   * This method allocates new memory.
   *
   * @param {Number} address The start address of the slice
   * @param {Number} length The length of memory map to slice out
   * @param {Number} [padByte=0xFF] The value of the byte assumed to be used as padding
   * @return {Uint8Array}
   */
  slicePad(address: number, length: number, padByte?: number): Uint8Array;

  /**
   * Checks whether the current memory map contains the one given as a parameter.
   *
   * <br/>
   * "Contains" means that all the offsets that have a byte value in the given
   * memory map have a value in the current memory map, and that the byte values
   * are the same.
   *
   * <br/>
   * An empty memory map is always contained in any other memory map.
   *
   * <br/>
   * Returns boolean <tt>true</tt> if the memory map is contained, <tt>false</tt>
   * otherwise.
   *
   * @param {MemoryMap} memMap The memory map to check
   * @return {Boolean}
   */
  contains(memMap: MemoryMap): boolean;
}

export default MemoryMap;
