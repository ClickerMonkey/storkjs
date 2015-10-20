
/**
 * A FastMap has the key-to-value benefits of a map and iteration benefits of an
 * array. This is especially beneficial when most of the time the contents of 
 * the structure need to be iterated and order doesn't matter (since removal 
 * performs a swap which breaks insertion order).
 *
 * @constructor
 * @memberOf Stork
 * @param {Stork.FastMap|object} [map]
 */
function FastMap(map)
{
  this.reset();
  this.putMap( map );
}

FastMap.prototype =
{

  /**
   * Resets the map by initializing the values, keys, and indexes.
   * 
   * @return {Stork.FastMap}
   */
  reset: function()
  {
    /**
     * An array of the values in this map.
     * @member {Array}
     */
    this.values = [];

    /**
     * An array of the keys in this map.
     * @type {Array}
     */
    this.keys = [];

    /**
     * An array of the original keys in this map.
     * @type {Array}
     */
    this.okeys = [];

    /**
     * An object of key to index mappings.
     * @type {Object}
     */
    this.indices = {};

    return this;
  },

  /**
   * Puts the value in the map by the given key.
   *
   * @param {String} key
   * @param {V} value
   * @param {K} originalKey
   * @return {Stork.FastMap}
   */
  put: function(key, value, originalKey)
  {
    if ( key in this.indices )
    {
      this.values[ this.indices[ key ] ] = value;
    }
    else
    {
      this.indices[ key ] = this.values.length;
      this.values.push( value );
      this.keys.push( key );
      this.okeys.push( originalKey );
    }

    return this;
  },

  /**
   * Puts all keys & values on the given map into this map overwriting any existing values mapped by similar keys.
   *
   * @param {FastMap|Object} map
   * @return {Stork.FastMap}
   */
  putMap: function(map)
  {
    if (map instanceof FastMap)
    {
      var keys = map.keys;
      var values = map.values;
      var okeys = map.okeys;

      for (var i = 0; i < keys.length; i++)
      {
        this.put( keys[ i ], values[ i ], okeys[ i ] );
      }
    }
    else if ( isObject( map ) )
    {
      for (var key in map)
      {
        this.put( key, map[ key ], key );
      }
    }

    return this;
  },

  /**
   * Returns the value mapped by the given key.
   *
   * @param {String} key
   * @return {V}
   */
  get: function(key)
  {
    return this.values[ this.indices[ key ] ];
  },

  /**
   * Removes the value by a given key
   *
   * @param {String} key
   * @return {Stork.FastMap}
   */
  remove: function(key)
  {
    var index = this.indices[ key ];

    if ( isNumber( index ) )
    {
      this.removeAt( index );
    }

    return this;
  },

  /**
   * Removes the value & key at the given index.
   *
   * @param {Number} index
   * @return {Stork.FastMap}
   */
  removeAt: function(index)
  {
    var key = this.keys[ index ];
    var lastValue = this.values.pop();
    var lastKey = this.keys.pop();
    var lastOkey = this.okeys.pop();

    if ( index < this.values.length )
    {
      this.values[ index ] = lastValue;
      this.keys[ index ] = lastKey;
      this.okeys[ index ] = lastOkey; 
      this.indices[ lastKey ] = index;
    }

    delete this.indices[ key ];

    return this;
  },

  /**
   * Returns the index of the value in the array given a key.
   *
   * @param {String} key
   * @return {Number}
   */
  indexOf: function(key)
  {
    return coalesce( this.indices[ key ], -1 );
  },

  /**
   * Returns whether this map has a value for the given key.
   *
   * @param {String} key
   * @return {Boolean}
   */
  has: function(key)
  {
    return key in this.indices;
  },

  /**
   * Returns whether the given input has overlap with keys in this map.
   *
   * @param {FastMap|Object} map
   * @return {Boolean}
   */
  hasOverlap: function(map)
  {
    var keys = this.keys;
    var indices = map.indices;

    for (var i = 0; i < keys.length; i++)
    {
      if ( keys[i] in indices )
      {
        return true;
      }
    }
   
    return false;
  },

  /**
   * Returns the number of elements in the map.
   *
   * @return {Number}
   */
  size: function()
  {
    return this.values.length;
  },

  /**
   * Reverses the order of the underlying values & keys.
   * 
   * @return {Stork.FastMap} -
   *         The referense to this map.
   */
  reverse: function()
  {
    var max = this.size() - 1;
    var half = Math.ceil( max / 2 );

    for (var i = 0; i < half; i++)
    {
      swap( this.values, i, max - i );
      swap( this.keys, i, max - i );
      swap( this.okeys, i, max - i );
    }

    this.rebuildIndex();

    return this;
  },

  /**
   * Sorts the underlying values & keys given a value compare function.
   * 
   * @param  {function} comparator
   *         A function which accepts two values and returns a number used for
   *         sorting. If the first argument is less than the second argument, a
   *         negative number should be returned. If the arguments are equivalent
   *         then 0 should be returned, otherwise a positive number should be
   *         returned.
   * @return {Stork.FastMap} -
   *         The reference to this map.
   */
  sort: function(comparator)
  {
    var map = this;

    // Sort this partition!
    function partition(left, right)
    {
      var pivot = map.values[ Math.floor((right + left) / 2) ];
      var i = left;
      var j = right;

      while (i <= j) 
      {
        while (comparator( map.values[i], pivot ) < 0) i++
        while (comparator( map.values[j], pivot ) > 0) j--;

        if (i <= j) {
          swap( map.values, i, j );
          swap( map.keys, i, j );
          swap( map.okeys, i, j );
          i++;
          j--;
        }
      }

      return i;
    }

    // Quicksort
    function qsort(left, right)
    {
      var index = partition( left, right );

      if (left < index - 1) 
      {
        qsort( left, index - 1 );
      }

      if (index < right) 
      {
        qsort( index, right );
      }
    }

    var right = this.size() - 1;

    // Are there elements to sort?
    if ( right > 0 )
    {
      qsort( 0, right );

      this.rebuildIndex();
    }

    return this;
  },

  /**
   * Rebuilds the index based on the keys.
   * 
   * @return {Stork.FastMap} -
   *         The reference to this map.
   */
  rebuildIndex: function()
  {
    this.indices = {};

    for (var i = 0; i <= right; i++)
    {
      this.indices[ this.keys[ i ] ] = i;
    }

    return this;
  }

};