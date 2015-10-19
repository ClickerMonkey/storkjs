
Stork.adapter('memory', 1, 
{
  valid: function() 
  {
    return true;
  },

  init: function(options, success, failure) 
  {
    var promise = new Promise( this, success, failure );

    this.loaded = true;
    this.finishInitialization( promise, [this] );
    
    return promise;
  },

  reload: function(success, failure)
  {
    var promise = new Promise( this, success, failure );

    this.finishReload( promise );

    return promise;
  },

  _destroy: function(promise)
  {
    this.cache.reset();

    promise.$success();
  },

  _put: function(key, value, rawKey, rawValue, promise)
  {
    var previousValue = this.cache.get( rawKey );

    this.cache.put( rawKey, value, key );

    promise.$success( [key, value, previousValue] );
  },

  _remove: function(key, rawKey, value, promise)
  {
    this.cache.remove( rawKey );

    promise.$success( [value, key] );
  }

});