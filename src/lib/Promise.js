
/**
 * Instantiates a new Promise. 
 *
 * @constructor
 * @memberOf Stork
 * @param {Object} context
 *        The `this` to apply to the success, failure, and error callbacks.
 * @param {function} [success]
 *        A success callback to add to be invoked.
 * @param {function} [failure]
 *        A failure callback to add to be invoked.
 * @param {Stork.Promise} [root]
 *        The root promise, if one exists.
 */
function Promise(context, success, failure, root)
{
  /**
   * The `this` to apply to the callbacks.
   * 
   * @type {Object}
   */
  this.context = context;

  /**
   * The root promise in the chain of promises.
   * 
   * @type {Promise}
   */
  this.root = root || this;

  /**
   * The next promise in the chain of promises.
   * 
   * @type {Promise}
   */
  this.next = null;

  /**
   * The first valid promise returned from a success callback.
   * @private
   * 
   * @type {Promise}
   */
  this.nextPromise = null;

  /**
   * The current state of this promise.
   * 
   * @type {Number}
   * @default Promise.PENDING
   */
  this.state = Promise.PENDING;

  /**
   * An array of success callbacks to invoke when the promise is marked as
   * successful.
   * 
   * @type {function[]}
   */
  this.successes = [];

  /**
   * An array of failure callbacks to invoke when the promise is marked as
   * failed.
   * 
   * @type {function[]}
   */
  this.failures = [];

  /**
   * An array of error callbacks stored at the root promise.
   * 
   * @type {function[]}
   */
  this.errors = [];

  /**
   * An array of arguments that are to be passed to the success or failure 
   * callbacks.
   * 
   * @type {Array}
   */
  this.args = null;

  /**
   * Whether this promise should look at the result of the failure callbacks 
   * for a promise to bind to and continue the chain.
   * 
   * @type {boolean}
   */
  this.chainFailureResult = false;

  // Queue the passed in success & failure callbacks.
  this.$queue( success, failure );
}

/**
 * Promise is awaiting for a success or failure notification.
 * @type {Number}
 */
Promise.PENDING = 0;

/**
 * Promise has been marked as a failure.
 * @type {Number}
 */
Promise.FAILURE = 1;

/**
 * Promise has been marked as a success.
 * @type {Number}
 */
Promise.SUCCESS = 2;

/**
 * Promise has been marked as a success and the next promise has been notified.
 * @type {Number}
 */
Promise.CHAINED = 3;


Promise.prototype = 
{
  /**
   * Adds success and optionally a failure callback to be invoked when the 
   * promised operation completes. The success callback can return a promise 
   * to chain promises.
   * 
   * @param  {function} success
   *         The function to invoke with the success arguments.
   * @param  {function} [failure]
   *         The function to invoke with the failure arguments.
   * @return {Stork.Promise} -
   *         The next promise to invoke when the returned promise from the 
   *         success callback finishes.
   */
  then: function(success, failure)
  {
    this.$queue( success, failure );  

    if ( !this.next )
    {
      this.next = new Promise( this.context, undefined, undefined, this );
    }
   
    if ( this.state & Promise.SUCCESS ) 
    {
      this.$handleSuccesses();
    } 
    else if ( this.state === Promise.FAILURE ) 
    {
      this.$handleFailures();
    }

    return this.next;
  },

  /**
   * Adds a callback to be invoked when either a success or failure occurs on
   * this promise. If a promise is returned by the callback - once that promise
   * completes the next promise will be processed on either success or failure.
   * 
   * @param  {function} complete
   *         The function to invoke when either a success or a failure occurs.
   * @return {Stork.Promise} - 
   *         The next promise to invoke when the returned promise from the
   *         success callback finishes.
   */
  either: function(complete)
  {
    this.chainFailureResult = true;

    return this.then( complete, complete );
  },

  /**
   * Adds a generic error to be called if any of the promises in the chain have
   * failed.
   * 
   * @param  {function} error
   *         A function to invoke if any of the promises fail.
   * @return {Stork.Promise} -
   *         A reference to this promise.
   */
  error: function(error)
  {
    if ( isFunc( error ) )
    {
      this.root.errors.push( error );

      if ( this.state === Promise.FAILURE )
      {
        this.$handleFailures();
      }  
    }

    return this;
  },

  // When the given promise finishes it will finish this promise as well.
  $bindTo: function(to, replacementArguments)
  {
    var from = this;

    to.then(
      function() {
        from.context = to.context;
        from.$success( coalesce( replacementArguments, to.args ) );
      },
      function() {
        from.context = to.context;
        from.$failure( coalesce( replacementArguments, to.args ) );
      })
    ;
  },

  // Returns true if the promise has yet to finish.
  $pending: function()
  {
    return this.state === Promise.PENDING;
  },

  // Adds a success and/or failure callback to this promise.
  $queue: function(success, failure)
  {
    if ( isFunc( success ) ) this.successes.push( success );
    if ( isFunc( failure ) ) this.failures.push( failure );
  },

  // Executes all successes currently on the promise.
  $handleSuccesses: function()
  {
    var succs = this.successes;
    for (var i = 0; i < succs.length; i++) 
    {
      var s = succs[ i ];
      var result = s.apply( this.context, this.args );

      if ( result instanceof Promise && !this.nextPromise ) 
      {
        this.nextPromise = result;
      }
    }

    succs.length = 0;

    this.$handleNext();
  },

  // If a next promise is given and one of the success callbacks return a 
  // promise, this promise is bound to the returned promise to complete the 
  // link in the chain.
  $handleNext: function()
  {
    var next = this.next;
    var returned = this.nextPromise;

    if (next && returned && (this.state === Promise.SUCCESS || (this.state === Promise.FAILURE && this.chainFailureResult)))
    {
      next.$bindTo( returned );

      this.state = Promise.CHAINED;
    }
  },

  // Marks this promise as a success if the promise hasn't finished yet.
  $success: function(args)
  {
    if ( this.state === Promise.PENDING ) 
    {
      this.args = args || [];
      this.state = Promise.SUCCESS;
      this.$handleSuccesses();
    }

    return this;
  },

  // Executes all failures currently on the promise.
  $handleFailures: function()
  {
    var fails = this.failures;
    for (var i = 0; i < fails.length; i++) 
    {
      var f = fails[ i ];
      var result = f.apply( this.context, this.args );

      if ( this.chainFailureResult && result instanceof Promise && !this.nextPromise )
      {
        this.nextPromise = result;
      }
    }

    fails.length = 0;

    var errors = this.root.errors;
    var errorArgument = [ this.args[ this.args.length - 1 ] ];

    for (var i = 0; i < errors.length; i++)
    {
      errors[ i ].apply( this.context, errorArgument );
    }

    errors.length = 0;

    this.$handleNext();
  },

  // Marks this promise as a failure if the promise hasn't finished yet.
  $failure: function(args)
  {
    if ( this.state === Promise.PENDING ) 
    {
      this.args = args || [];
      this.state = Promise.FAILURE;
      this.$handleFailures();
    }

    return this;
  },

  // Resets this promise removing all listeners
  $reset: function() 
  {
    this.state = Promise.PENDING;
    this.chainFailureResult = false;
    this.$clear();
    this.$stop();

    return this;
  },

  // Removes all listeners
  $clear: function()
  {
    this.successes.length = 0;
    this.failures.length = 0;
    this.errors.length = 0;

    return this;
  },

  // Stops any chained promises from getting called if they haven't been
  // called already.
  $stop: function()
  {
    this.next = null;
    this.nextPromise = null;

    return this;
  }

};



/**
 * Creates a Promise that has already successfully ran.
 * 
 * @param {Object} context
 *        The `this` to apply to the success, failure, and error callbacks.
 * @return {Stork.Promise}
 *         The promise created.
 */
Promise.Done = function(context)
{
  return new Promise( context ).$success();
};

/**
 * Creates a Promise that waits for a given number of success to be considered
 * a success, any failure will cause subsequent successes to be ignored.
 * 
 * @param {Number} groupSize
 *        The number of $success calls that need to be made for the promise to
 *        actually be considered a success.
 * @param {Object} context
 *        The `this` to apply to the success, failure, and error callbacks.
 * @param {function} [success]
 *        A success callback to add to be invoked.
 * @param {function} [failure]
 *        A failure callback to add to be invoked.
 */
Promise.Group = function(groupSize, context, success, failure)
{
  var group = new Promise( context, success, failure );
  var count = 0;
  var $success = group.$success;

  // Override it! Inefficient, but easiest for now.
  group.$success = function( args )
  {
    if ( this.state === Promise.PENDING )
    {
      if ( ++count === groupSize )
      {
        $success.call( group, args );
      }
    }
  };

  return group;
};