Stork.plugin((function()
{

  /**
   * The format of success callback for aggregation functions.
   * 
   * @callback Stork~aggregateSuccess
   * @param {Number} aggregatedValue
   *        The result of the aggregation function.
   */

  /**
   * The format of failure callback for aggregation functions.
   * 
   * @callback Stork~aggregateFailure
   * @param {Any} error 
   *        The error that was thrown.
   */
  
  /**
   * The format of an accumulation callback for aggregation functions.
   *
   * @callback Stork~aggregateAccumulate
   * @param {Any} value
   *        The value to process for accumulation.
   */
  
  /**
   * The format of an accumulation callback for aggregation functions.
   *
   * @callback Stork~aggregateResult
   * @return {Any}
   *         The result of the accumulated values.
   */

  /**
   * Performs an aggregation on key-value pairs where the value is an `Object` 
   * which may have a specific property to aggregate. The result of the 
   * aggregation is returned to the callback.
   *
   * This is part of the aggregation plugin.
   * 
   * @memberOf Stork#
   * @param  {String} property
   *         The property on the object to pass to the accumulation function.
   * @param  {Stork~aggregateAccumulate} accumulate
   *         The function to invoke with the value of the property.
   * @param  {Stork~aggregateResult} getResult
   *         The function to call at the end to returned the aggregated value.
   * @param  {Stork~aggregateSuccess} [success]
   *         The function to invoke when a value is successfully aggregated.
   * @param  {Stork~aggregateSuccess} [failure]
   *         The function to invoke if there's a problem.
   * @return {Stork.Promise} -
   *         The promise that can be used to listen for success or failure, as
   *         well as chaining additional calls.
   */
  function aggregate(property, accumulate, getResult, promise)
  {
    var onSuccess = function(values, keys)
    {
      var returnedValue = undefined;

      for (var i = 0; i < values.length; i++)
      {
        var v = values[ i ];

        if (isObject( v ) && property in v)
        {
          accumulate( v[ property ] );
        }
      }

      promise.$success( [ getResult() ] )
    };
    var onFailure = function(e)
    {
      promise.$failure( [e] );
    };

    this.all( onSuccess, onFailure );
  }

  /**
   * Returns the number of values that are objects and have the specified 
   * property to the callback.
   *
   * This is part of the aggregation plugin.
   *
   * *Usage*
   * ```javascript
   * db.count('name', function(count) {
   *   // count = the number of objects with the property 'name'
   * });
   * ```
   * 
   * @memberOf Stork#
   * @param  {String} property
   *         The property on the object to look for.
   * @param  {Stork~aggregateSuccess} [success]
   *         The function to invoke with the number of values with the property.
   * @param  {Stork~aggregateSuccess} [failure]
   *         The function to invoke if there's a problem.
   * @return {Stork.Promise} -
   *         The promise that can be used to listen for success or failure, as
   *         well as chaining additional calls.
   */
  function count(property, promise)
  {
    var total = 0;

    var accumulate = function(v)
    {
      total++;
    };
    var getResult = function()
    {
      return total;
    };

    aggregate( property, accumulate, getResult, promise );
  }

  /**
   * Returns the sum of a set of values taken from a property on all `Object` 
   * values to the callback.
   *
   * This is part of the aggregation plugin.
   * 
   * *Usage*
   * ```javascript
   * db.sum('kills', function(sum) {
   *   // sum = total of all kills
   * });
   * ```
   * 
   * @memberOf Stork#
   * @param  {String} property
   *         The property on the object to sum.
   * @param  {Stork~aggregateSuccess} [success]
   *         The function to invoke with the sum.
   * @param  {Stork~aggregateSuccess} [failure]
   *         The function to invoke if there's a problem.
   * @return {Stork.Promise} -
   *         The promise that can be used to listen for success or failure, as
   *         well as chaining additional calls.
   */
  function sum(property, promise)
  {
    var summing = 0;

    var accumulate = function(v)
    {
      if (isNumber(v))
      {
        summing += v;
      }
    };
    var getResult = function()
    {
      return summing;
    };

    aggregate( property, accumulate, getResult, promise );
  }


  /**
   * Returns the average of a set of values taken from a property on all `Object` 
   * values to the callback.
   *
   * This is part of the aggregation plugin.
   * 
   * *Usage*
   * ```javascript
   * db.avg('age', function(avg) {
   *   // avg = the average age
   * });
   * ```
   * 
   * @memberOf Stork#
   * @param  {String} property
   *         The property on the object to average.
   * @param  {Stork~aggregateSuccess} [success]
   *         The function to invoke with the average.
   * @param  {Stork~aggregateSuccess} [failure]
   *         The function to invoke if there's a problem.
   * @return {Stork.Promise} -
   *         The promise that can be used to listen for success or failure, as
   *         well as chaining additional calls.
   */
  function avg(property, promise)
  {
    var summing = 0;
    var total = 0;

    var accumulate = function(v)
    {
      if (isNumber(v))
      {
        summing += v;
        total++;
      }
    };
    var getResult = function()
    {
      return summing / total;
    };

    aggregate( property, accumulate, getResult, promise );
  }

  /**
   * Returns the minimum value of a set of values taken from a property on all 
   * `Object` values to the callback.
   *
   * This is part of the aggregation plugin.
   * 
   * *Usage*
   * ```javascript
   * db.min('age', function(min) {
   *   // min = the minimum age
   * });
   * ```
   * 
   * @memberOf Stork#
   * @param  {String} property
   *         The property on the object to find the minimum value of.
   * @param  {Stork~aggregateSuccess} [success]
   *         The function to invoke with the minimum value.
   * @param  {Stork~aggregateSuccess} [failure]
   *         The function to invoke if there's a problem.
   * @return {Stork.Promise} -
   *         The promise that can be used to listen for success or failure, as
   *         well as chaining additional calls.
   */
  function min(property, promise)
  {
    var minValue = Number.MAX_VALUE;

    var accumulate = function(v)
    {
      if (isNumber(v))
      {
        minValue = Math.min( minValue, v );
      }
    };
    var getResult = function()
    {
      return minValue;
    };

    aggregate( property, accumulate, getResult, promise );
  }

  /**
   * Returns the maximum value of a set of values taken from a property on all 
   * `Object` values to the callback.
   *
   * This is part of the aggregation plugin.
   * 
   * *Usage*
   * ```javascript
   * db.max('age', function(max) {
   *   // max = the maximum age
   * });
   * ```
   * 
   * @memberOf Stork#
   * @param  {String} property
   *         The property on the object to find the maximum value of.
   * @param  {Stork~aggregateSuccess} [success]
   *         The function to invoke with the maximum value.
   * @param  {Stork~aggregateSuccess} [failure]
   *         The function to invoke if there's a problem.
   * @return {Stork.Promise} -
   *         The promise that can be used to listen for success or failure, as
   *         well as chaining additional calls.
   */
  function max(property, promise)
  {
    var maxValue = Number.MAX_VALUE;

    var accumulate = function(v)
    {
      if (isNumber(v))
      {
        maxValue = Math.min( maxValue, v );
      }
    };
    var getResult = function()
    {
      return maxValue;
    };

    aggregate( property, accumulate, getResult, promise );
  }

  var METHODS = 
  {
    aggregate:  $promise( 'aggregate', aggregate ),
    count:      $promise( 'count', count ),
    sum:        $promise( 'sum', sum ),
    avg:        $promise( 'avg', avg ),
    min:        $promise( 'min', min ),
    max:        $promise( 'max', max )
  }; 

  return function(stork)
  {
    copy( METHODS, stork );
  };

})());


  