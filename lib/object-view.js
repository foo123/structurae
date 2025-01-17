const StringView = require('./string-view');
const StringArrayView = require('./string-array-view');
const ArrayViewMixin = require('./array-view');
const TypedArrayViewMixin = require('./typed-array-view');

/**
 * @typedef {('int8' | 'uint8' | 'int16' | 'uint16'
 * | 'int32' | 'uint32' | 'float32' | 'float64'
 * | 'bigint64' | 'biguint64' | 'string' | 'array' | 'object' | 'typedarray'
 * | Class<ArrayView>|Class<ObjectView>|Class<TypedArrayView>)} ObjectViewFieldType
 */

/**
 * @typedef {Object} ObjectViewField
 * @property {ObjectViewFieldType} type
 * @property {number} [size] the maximum size in bytes for a string type
 * @property {boolean} [littleEndian]
 * @property {number} [start]
 * @property {number} [length]
 * @property {Class<ArrayView>|Class<ObjectView>|Class<TypedArrayView>} [ctor]
 */

/**
 * @private
 */
const fieldSizes = {
  int8: 1,
  uint8: 1,
  int16: 2,
  uint16: 2,
  int32: 4,
  uint32: 4,
  float32: 4,
  float64: 8,
  bigint64: 8,
  biguint64: 8,
};

/**
 * @extends DataView
 */
class ObjectView extends DataView {
  /**
   * Returns the value of a given field.
   *
   * @param {string} field the name of the field
   * @returns {*} value of the field
   */
  get(field) {
    const {
      type, littleEndian, start, ctor, length, stringLength,
    } = this.constructor.schema[field];
    switch (type) {
      case 'int8': return this.getInt8(start);
      case 'uint8': return this.getUint8(start);
      case 'int16': return this.getInt16(start, littleEndian);
      case 'uint16': return this.getUint16(start, littleEndian);
      case 'int32': return this.getInt32(start, littleEndian);
      case 'uint32': return this.getUint32(start, littleEndian);
      case 'float32': return this.getFloat32(start, littleEndian);
      case 'float64': return this.getFloat64(start, littleEndian);
      case 'bigint64': return this.getBigInt64(start, littleEndian);
      case 'biguint64': return this.getBigUint64(start, littleEndian);
      case 'stringarray': return new StringArrayView(this.buffer, this.byteOffset + start, length, stringLength);
      default: return this.getView(start, length, ctor);
    }
  }

  /**
   * @private
   * @param {number} position
   * @param {Class<ArrayView>|Class<ObjectView>} ctor
   * @param {number} size
   * @returns {Array<Object>}
   */
  getArray(position, ctor, size) {
    const { schema, objectLength } = ctor;
    const result = new Array(size);
    for (let i = 0; i < size; i++) {
      result[i] = this.getObject(schema, position + (i * objectLength));
    }
    return result;
  }

  /**
   * @private
   * @param {number} position
   * @param {number} size
   * @param {number} length
   * @param {number} stringLength
   * @returns {void}
   */
  getStringArray(position, size, length, stringLength) {
    const array = new Array(size);
    for (let i = 0; i < size; i++) {
      const string = new StringView(
        this.buffer, this.byteOffset + position + (i * stringLength), stringLength,
      );
      array[i] = string.toString();
    }
    return array;
  }

  /**
   * @private
   * @param {number} position
   * @param {Class<TypedArrayView>} ctor
   * @param {number} size
   * @returns {Array<number>}
   */
  getTypedArray(position, ctor, size) {
    const { typeGetter, offset, littleEndian } = ctor;
    const result = new Array(size);
    for (let i = 0; i < size; i++) {
      result[i] = this[typeGetter](position + (i << offset), littleEndian);
    }
    return result;
  }

  /**
   * @private
   * @param {object} schema
   * @param {number} offset
   * @returns {Object}
   */
  getObject(schema, offset) {
    const fields = Object.keys(schema);
    const result = {};
    for (let i = 0; i < fields.length; i++) {
      const name = fields[i];
      const {
        type, littleEndian, start, ctor: Ctor, length, size, stringLength,
      } = schema[name];
      let value;
      const position = offset + start;
      switch (type) {
        case 'int8': value = this.getInt8(position); break;
        case 'uint8': value = this.getUint8(position); break;
        case 'int16': value = this.getInt16(position, littleEndian); break;
        case 'uint16': value = this.getUint16(position, littleEndian); break;
        case 'int32': value = this.getInt32(position, littleEndian); break;
        case 'uint32': value = this.getUint32(position, littleEndian); break;
        case 'float32': value = this.getFloat32(position, littleEndian); break;
        case 'float64': value = this.getFloat64(position, littleEndian); break;
        case 'bigint64': value = this.getBigInt64(position, littleEndian); break;
        case 'biguint64': value = this.getBigUint64(position, littleEndian); break;
        case 'string': value = new StringView(this.buffer, this.byteOffset + position, length).toString(); break;
        case 'typedarray': value = this.getTypedArray(position, Ctor, size); break;
        case 'stringarray': value = this.getStringArray(position, size, length, stringLength); break;
        case 'array': value = this.getArray(position, Ctor, size); break;
        default: value = this.getObject(Ctor.schema, position);
      }
      result[name] = value;
    }
    return result;
  }

  /**
   * @private
   * @param {number} position
   * @param {number} length
   * @param {Class<ArrayView>|Class<TypedArrayView>
   *   |Class<ObjectView>|Class<StringView>} [Ctor=StringView]
   * @returns {ArrayView|TypedArrayView|ObjectView|StringView}
   */
  getView(position, length, Ctor = StringView) {
    return new Ctor(this.buffer, this.byteOffset + position, length);
  }

  /**
   * Sets a value to a field.
   *
   * @param {string} field the name of the field
   * @param {*} value the value to be set
   * @returns {ObjectView}
   */
  set(field, value) {
    return this.setValue(field, value);
  }

  /**
   * @private
   * @param {number} position
   * @param {ArrayLike<object>} value
   * @param {Class<ArrayView>|Class<ObjectView>} ctor
   * @param {number} size
   * @returns {void}
   */
  setArray(position, value, ctor, size) {
    const { fields, schema } = ctor;
    const max = (size < value.length ? size : value.length);
    for (let i = 0; i < max; i++) {
      for (let j = 0; j < fields.length; j++) {
        const name = fields[j];
        this.setValue(name, value[i][name], schema, position + (i * ctor.objectLength));
      }
    }
  }

  /**
   * @private
   * @param {number} position
   * @param {Object} value
   * @param {Class<ObjectView>} ctor
   * @returns {void}
   */
  setObject(position, value, ctor) {
    const { fields, schema } = ctor;
    for (let i = 0; i < fields.length; i++) {
      const name = fields[i];
      if (Reflect.has(value, name)) this.setValue(name, value[name], schema, position);
    }
  }

  /**
   * @private
   * @param {number} position
   * @param {string} value
   * @param {number} length
   * @returns {void}
   */
  setString(position, value, length) {
    new Uint8Array(this.buffer, this.byteOffset + position, length)
      .fill(0)
      .set(StringView.fromString(value));
  }

  /**
   * @private
   * @param {number} position
   * @param {string} value
   * @param {number} size
   * @param {number} length
   * @param {number} stringLength
   * @returns {void}
   */
  setStringArray(position, value, size, length, stringLength) {
    const array = new Uint8Array(this.buffer, this.byteOffset + position, length);
    array.fill(0);
    const max = (size < value.length ? size : value.length);
    for (let i = 0; i < max; i++) {
      const string = StringView.fromString(value[i], stringLength);
      array.set(string, i * stringLength);
    }
  }

  /**
   * @private
   * @param {number} position
   * @param {ArrayLike<number>} value
   * @param {Class<TypedArrayView>} ctor
   * @param {number} size
   * @returns {void}
   */
  setTypedArray(position, value, ctor, size) {
    const { typeSetter, offset, littleEndian } = ctor;
    const max = (size < value.length ? size : value.length);
    for (let i = 0; i < max; i++) {
      this[typeSetter](position + (i << offset), value[i], littleEndian);
    }
  }

  /**
   * @private
   * @param {string} field
   * @param {*} value
   * @param {*} [schema]
   * @param {number} [offset=0]
   * @returns {ObjectView}
   */
  setValue(field, value, schema = this.constructor.schema, offset = 0) {
    const {
      type, littleEndian, start, ctor, length, size, stringLength,
    } = schema[field];
    const position = offset + start;
    switch (type) {
      case 'int8':
        this.setInt8(position, value);
        break;
      case 'uint8':
        this.setUint8(position, value);
        break;
      case 'int16':
        this.setInt16(position, value, littleEndian);
        break;
      case 'uint16':
        this.setUint16(position, value, littleEndian);
        break;
      case 'int32':
        this.setInt32(position, value, littleEndian);
        break;
      case 'uint32':
        this.setUint32(position, value, littleEndian);
        break;
      case 'float32':
        this.setFloat32(position, value, littleEndian);
        break;
      case 'float64':
        this.setFloat64(position, value, littleEndian);
        break;
      case 'bigint64':
        this.setBigInt64(position, value, littleEndian);
        break;
      case 'biguint64':
        this.setBigUint64(position, value, littleEndian);
        break;
      case 'string':
        this.setString(position, value, length);
        break;
      case 'typedarray':
        this.setTypedArray(position, value, ctor, size);
        break;
      case 'array':
        this.setArray(position, value, ctor, size);
        break;
      case 'stringarray':
        this.setStringArray(position, value, size, length, stringLength);
        break;
      default:
        this.setObject(position, value, ctor);
        break;
    }
    return this;
  }

  /**
   * Sets an ObjectView value to a field.
   *
   * @param {string} field the name of the field
   * @param {ObjectView|ArrayView|TypedArrayView|StringView} value the view to set
   * @returns {ObjectView}
   */
  setView(field, value) {
    const { start } = this.constructor.schema[field];
    new Uint8Array(this.buffer, this.byteOffset, this.byteLength)
      .set(
        new Uint8Array(value.buffer, value.byteOffset, value.byteLength),
        start,
      );
    return this;
  }

  /**
   * Returns an Object corresponding to the object view.
   *
   * @returns {Object}
   */
  toObject() {
    return this.getObject(this.constructor.schema, 0);
  }

  /**
   * Assigns fields of a given object to the provided object view
   * or a new object view.
   *
   * @param {Object} object the object to take data from
   * @param {ObjectView} [view] the object view to assign fields to
   * @returns {ObjectView}
   */
  static from(object, view) {
    const objectView = view || new this(new ArrayBuffer(this.getLength()));
    objectView.setObject(0, object, objectView.constructor);
    return objectView;
  }

  /**
   * Returns the byte length of an object view.
   *
   * @returns {number}
   */
  static getLength() {
    if (!this.isInitialized) this.initialize();
    return this.objectLength;
  }

  /**
   * @private
   * @returns {void}
   */
  static initialize() {
    const { schema } = this;
    const fields = Object.keys(schema);
    let lastOffset = 0;
    for (let i = 0; i < fields.length; i++) {
      const name = fields[i];
      const field = schema[name];
      const {
        type, size, littleEndian, length,
      } = field;
      field.start = lastOffset;
      switch (type) {
        case 'int8':
        case 'uint8':
        case 'int16':
        case 'uint16':
        case 'int32':
        case 'uint32':
        case 'float32':
        case 'float64':
        case 'bigint64':
        case 'biguint64':
          if (size) {
            field.ctor = TypedArrayViewMixin(type, littleEndian);
            field.type = 'typedarray';
            field.length = field.ctor.getLength(size);
          } else {
            field.length = fieldSizes[type];
          }
          break;
        case 'string':
          if (size) {
            field.type = 'stringarray';
            field.stringLength = length;
            field.length = StringArrayView.getLength(size, length);
          }
          break;
        default:
          if (typeof type === 'string') throw TypeError(`Type "${type}" is not a valid type.`);
          if (size) {
            field.type = 'array';
            field.ctor = ArrayViewMixin(type);
            field.length = field.ctor.getLength(size);
          } else {
            field.type = 'object';
            field.ctor = type;
            field.length = type.getLength();
          }
      }
      lastOffset += field.length;
    }
    this.objectLength = lastOffset;
    this.fields = fields;
    this.isInitialized = true;
  }
}
/**
 * @private
 * @type {Array<ObjectViewField>}
 */
ObjectView.fields = undefined;

/**
 * @private
 */
ObjectView.schema = undefined;

/**
 * @private
 */
ObjectView.objectLength = 0;

/** @type {boolean} */
ObjectView.isInitialized = false;

module.exports = ObjectView;
