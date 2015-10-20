Stork.plugin((function()
{

  /**
   * The format of the condition callback for {@link Stork#where}.
   * 
   * @callback Stork~where
   * @param {Any} value
   *        The value to inspect and return true if you want it returned.
   * @param {Any} key
   *        The key to inspect and return true if you want it returned.
   */
  
  /**
   * The format of success callback for {@link Stork#where}.
   * 
   * @callback Stork~whereSuccess
   * @param {Array} values
   *        The values matching the given condition.
   * @param {Array} keys
   *        The keys matching the given condition.
   */

  /**
   * The format of failure callback for {@link Stork#where}.
   * 
   * @callback Stork~whereFailure
   * @param {Any} error 
   *        The error that was thrown.
   */

  /**
   * Returns a subset of key-value pairs that match a condition function to the 
   * callback.
   *
   * This is part of the query plugin.
   *
   * *Usage*
   * ```javascript
   * var condition = function(value, key) {
   *   // return true if key-value matches some condition
   * };
   * var onSuccessFunc = function(value, key) {
   *   // handle success
   * };
   * var onFailureFunc = function(key, error) {
   *   // uh oh!
   * };
   * db.where( condition, onSucessFunc, onFailureFunc ); // listen for success/failure
   * db.where( condition ).then( onSuccessFunc, onFailureFunc ); // listen to promise
   * ```
   *
   * @memberOf Stork#
   * @param  {Stork~where} condition
   *         The function to invoke on each key-value pair to determine whether
   *         that pair is included in the results.
   * @param  {Stork~whereSuccess} [success]
   *         The function to invoke with the matched key-value pairs.
   * @param  {Stork~whereFailure} [failure]
   *         The function to invoke if there was a problem retrieving the
   *         key-value pairs.
   * @return {Stork.Promise} -
   *         The promise that can be used to listen for success or failure, as
   *         well as chaining additional calls.
   */
  function where(condition, promise)
  {
    var onSuccess = function(values, keys)
    {
      var matchedKeys = [];
      var matchedValues = [];

      for (var i = 0; i < values.length; i++)
      {
        var v = values[ i ];
        var k = keys[ i ];

        if ( condition( v, k ) )
        {
          matchedValues.push( v );
          matchedKeys.push( k );
        }
      }

      promise.$success( [matchedValues, matchedKeys] );
    };
    var onFailure = function(e)
    {
      promise.$failure( [e] );
    };

    this.all( onSuccess, onFailure );
  }

  /**
   * The format of success callback for {@link Stork#select}.
   * 
   * @callback Stork~selectSuccess
   * @param {Array} values
   *        If columns is a string this is an array of values pulled from the
   *        same property on all values that are objects. If columns is an array
   *        this is an array of objects containing the properties that exist
   *        in the columns array.
   * @param {Array} keys
   *        An array of the keys for pointing to the original values.
   */

  /**
   * The format of failure callback for {@link Stork#select}.
   * 
   * @callback Stork~selectFailure
   * @param {String|Array} columns
   *        The property you wanted to return or an array of properties to return.
   * @param {Any} error 
   *        The error that was thrown.
   */
  
  /**
   * Returns column values (if columns is a string) or an array of objects of 
   * column values (if columns is an array) to the callback.
   *
   * This is part of the query plugin.
   *
   * *Usage*
   * ```javascript
   * var onSuccessFunc = function(values, keys) {
   *   // handle success
   * };
   * var onFailureFunc = function(columns, error) {
   *   // uh oh!
   * };
   * db.select( 'name', onSucessFunc, onFailureFunc ); // listen for success/failure
   * db.select( ['name', 'id'] ).then( onSuccessFunc, onFailureFunc ); // listen to promise
   * ```
   *
   * @memberOf Stork#
   * @param  {String|Array} columns
   *         The property you want to return or an array of properties to return.
   * @param  {Stork~selectSuccess} [success]
   *         The function to invoke with the selected properties.
   * @param  {Stork~selectFailure} [failure]
   *         The function to invoke if there was a problem selecting the columns.
   * @return {Stork.Promise} -
   *         The promise that can be used to listen for success or failure, as
   *         well as chaining additional calls.
   */
  function select(columns, promise)
  {
    var onSuccess = function(values, keys)
    {
      var results = [];
      var resultKeys = [];

      for (var i = 0; i < values.length; i++)
      {
        var v = values[ i ];

        if ( isObject( v ) )
        {
          if ( isString( columns ) )
          {
            if ( columns in v )
            {
              results.push( v[ columns ] );
              resultKeys.push( keys[ i ] );
            }
          }
          else if ( isArray( columns ) )
          {
            var resultObject = {};
            var resultColumns = 0;

            for (var k = 0; k < columns.length; k++)
            {
              var c = columns[ k ];

              if ( c in v )
              {
                resultObject[ c ] = v[ c ];
                resultColumns++;
              }
            }

            if ( resultColumns > 0 )
            {
              results.push( resultObject );
              resultKeys.push( keys[ i ] );
            }
          }
        }
      }

      promise.$success( [results, resultKeys] );
    };
    var onFailure = function(e)
    {
      promise.$failure( [columns, e] );
    };

    this.all( onSuccess, onFailure );
  }

  /**
   * The format of the comparater for {@link Stork#sort}.
   *
   * @callback Stork~sortComparator
   * @param {Any} a
   *        The first value to compare.
   * @param {Any} b
   *        The second value to compare.
   * @return {Number} -
   *         A negative number if `a < b`, a positive number of `a > b` and 0
   *         if `a == b`.
   */

  /**
   * The format of success callback for {@link Stork#sort}.
   * 
   * @callback Stork~sortSuccess
   * @param {Array} values
   *        The array of sorted values.
   * @param {Array} keys
   *        The array of sorted keys.
   */

  /**
   * The format of failure callback for {@link Stork#sort}.
   * 
   * @callback Stork~sortFailure
   * @param {Any} error 
   *        The error that was thrown.
   */
  
  /**
   * Sorts all key-value pairs and returns them to the callback. Next time the
   * key-value pairs are iterated over they will be returned in the same order.
   * The underlying structure should be considered unsorted anytime key-value
   * pairs are updated, added, or removed.
   *
   * This is part of the query plugin.
   *
   * *Usage*
   * ```javascript
   * var compareFunc = function(a, b) {
   *   // compare a & b and return a number
   * };
   * var onSuccessFunc = function(values, keys) {
   *   // handle success
   * };
   * var onFailureFunc = function(error) {
   *   // uh oh!
   * };
   * db.sort( compareFunc, false, onSucessFunc, onFailureFunc ); // listen for success/failure
   * db.sort( compareFunc ).then( onSuccessFunc, onFailureFunc ); // listen to promise
   * ```
   *
   * @memberOf Stork#
   * @param  {Stork~sortComparator} comparator
   *         The function used to compare two values.
   * @param  {Boolean} desc
   *         If the key-value pairs should be in descending (reversed) order.
   * @param  {Stork~sortSuccess} [success]
   *         The function to invoke with the sorted values & keys.
   * @param  {Stork~sortFailure} [failure]
   *         The function to invoke if there was a problem sorting the pairs.
   * @return {Stork.Promise} -
   *         The promise that can be used to listen for success or failure, as
   *         well as chaining additional calls.
   */
  function sort(comparator, desc, promise)
  {
    var onSuccess = function()
    {
      var cache = this.cache;

      cache.sort( comparator );

      if ( desc )
      {
        cache.reverse();
      }

      promise.$success( [cache.values, cache.okeys] );
    };
    var onFailure = function(e)
    {
      promise.$failure( [e] );
    };

    this.all( onSuccess, onFailure );
  }

  var METHODS = 
  {
    where:  $promise( 'where', where ),
    select: $promise( 'select', select ),
    sort:   $promise( 'sort', sort )
  }; 

  return function(stork)
  {
    copy( METHODS, stork );
  };

})());


  