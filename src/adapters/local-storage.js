
Stork.adapter('local-storage', 3, function()
{
  var store = window.localStorage;

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
        store.setItem( temp, temp );
        store.removeItem( temp );

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
        this.finishInitialization( promise, [this] );
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
      var prefix = this.prefix;
      var cache = new FastMap();

      try
      {
        for (var i = 0; i < store.length; i++)
        {
          var rawKey = store.key( i );

          if ( rawKey.substring( 0, prefix.length ) === prefix )
          {
            var rawValue = store.getItem( rawKey );
            var value = fromJson( rawValue );
            var key = this.decode( rawKey );

            cache.put( rawKey, value, key );
          }  
        }

        this.cache.overwrite( cache );
        this.loaded = true;
      }
      catch (e)
      {
        promise.$failure( [e] );
      }

      this.finishReload( promise );

      return promise;
    },

    _destroy: function(promise)
    {
      var stork = this;
      var prefix = this.prefix;
      var removeByKeys = function( keys )
      {
        try
        {
          for (var i = 0; i < keys.length; i++)
          {
            store.removeItem( keys[ i ] );
          }
        }
        catch (e)
        {
          promise.$failure( [e] );
        }

        if ( promise.$pending() )
        {
          stork.cache.reset();

          promise.$success();
        }
      };
      
      if ( this.loaded )
      {
        removeByKeys( this.cache.keys );
      }
      else
      {
        var keys = [];

        try
        {
          for (var i = 0; i < store.length; i++)
          {
            var rawKey = store.key( i );

            if ( rawKey.substring( 0, prefix.length ) === prefix )
            {
              keys.push( rawKey );
            }
          }  
        }
        catch (e)
        {
          promise.$failure( [e] );
        }

        if ( promise.$pending() )
        {
          removeByKeys( keys );          
        }
      }
    },

    _get: function(key, rawKey, promise)
    {
      try
      { 
        var rawValue = store.getItem( rawKey );

        if ( rawValue === null )
        {
          promise.$success( [undefined, key] );
        }
        else
        {
          var value = fromJson( rawValue );

          this.cache.put( rawKey, value, key );

          promise.$success( [value, key] ); 
        }
      }
      catch (e)
      {
        promise.$failure( [key, e] );
      }
    },

    _put: function(key, value, rawKey, rawValue, promise)
    {
      try
      {
        store.setItem( rawKey, rawValue );        
      }
      catch (e)
      {
        promise.$failure( [key, value, e] );
      }

      if ( promise.$pending() )
      {
        var previousValue = this.cache.get( rawKey );

        this.cache.put( rawKey, value, key );

        promise.$success( [key, value, previousValue] );
      }
    },

    _remove: function(key, rawKey, value, promise)
    {
      try
      {
        store.removeItem( rawKey );
      }
      catch (e)
      {
        promise.$failure( [key, e] );
      }

      if ( promise.$pending() )
      {
        this.cache.remove( rawKey );

        promise.$success( [value, key] );
      }
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