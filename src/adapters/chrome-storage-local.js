
Stork.adapter('chrome-storage-local', 4, function()
{
  var store = window.chrome && chrome.storage ? chrome.storage.local : false;

  function isError() 
  {
    return chrome && chrome.runtime && chrome.runtime.lastError;
  };

  return {

    encode: function(key)
    {
      return this.prefix + toJson( key );
    },

    decode: function(rawKey)
    {
      return fromJson( rawKey.substring( this.prefix.length ) );
    },

    valid: function() 
    {
      if (!store) 
      {
        return false;
      }

      try 
      {
        var temp = Math.random();
        var map = {};

        map[ temp ] = temp;
        store.set( map );
        store.remove( temp );

        return true;
      } 
      catch (e) 
      {
        return false;
      }
    },

    init: function(options, success, failure) 
    {
      var promise = new Promise( this, success, failure );
      
      this.prefix = coalesce( options.prefix, this.name + '-' );

      if ( this.lazy )
      {
        this._finishInitialization( promise, [this] );
      }
      else
      {
        promise.$bindTo( this.reload(), [this] );
      }

      return promise;
    },

    reload: function(success, failure)
    {
      var promise = new Promise( this, success, failure );
      var stork = this;
      var prefix = this.prefix;
      var cache = new FastMap();

      store.get( null, function(items)
      {
        if ( isError() )
        {
          promise.$failure( [isError()] );
        }
        else
        {
          for (var rawKey in items)
          {
            if ( rawKey.substring( 0, prefix.length ) === prefix )
            {
              cache.put( rawKey, items[ rawKey ], stork.decode( rawKey ) );
            }
          }

          stork.cache = cache;
          stork.loaded = true;

          stork.finishReload( promise );
        }

      });

      return promise;
    },

    _get: function(key, rawKey, promise)
    {
      store.get( rawKey, function(items)
      {
        if ( isError() )
        {
          promise.$failure( [key, isError()] );
        }
        else
        {
          if ( items.length )
          {
            var value = fromJson( items[0] );

            promise.$success( [value, key] );
          }
          else
          {
            promise.$success( [undefined, key] );
          }
        }
      });
    },

    _destroy: function(promise)
    {
      var stork = this;
      var removeByKeys = function()
      {
        store.remove( this.cache.keys, function()
        {
          if ( isError() ) 
          {
            promise.$failure( [isError()] );
          }
          else 
          {
            stork.cache.reset();

            promise.$success();
          }
        });
      };
      var onFailure = function(e)
      {
        promise.$failure( [e] );
      };

      if ( this.loaded )
      {
        removeByKeys();
      }
      else
      {
        this.reload( removeByKeys, onFailure );
      }
    },

    _put: function(key, value, rawKey, rawValue, promise)
    {
      var stork = this;
      var obj = {};

      obj[ rawKey ] = value;

      store.set( obj, function() 
      {
        if ( isError() ) 
        {
          promise.$failure( [key, value, isError()] );
        } 
        else 
        {
          var previousValue = stork.cache.get( rawKey );

          stork.cache.put( rawKey, value, key );

          promise.$success( [key, value, previousValue] );
        }
      });
    },

    _remove: function(key, rawKey, value, promise)
    {  
      var stork = this;

      store.remove( rawKey, function()
      {
        if ( isError() )
        {
          promise.$failure( [key, isError()] );
        }
        else
        {
          stork.cache.remove( rawKey );

          promise.$success( [value, key] );
        }
      });
    },

    _size: function(promise)
    {
      var onSuccess = function(keys, values)
      {
        promise.$success( [keys.length] );
      };
      var onFailure = function(e)
      {
        promise.$failure( [e] );
      };

      this.reload( onSuccess, onFailure );
    }

  }
});