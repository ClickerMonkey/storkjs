
Stork.adapter('window-name', 2, function()
{

  function loadData()
  {
    if ( !loadData.cache )
    {
      try
      {
        loadData.cache = fromJson( window.top.name );
      }
      catch (e)
      {
        loadData.cache = {};
      }
    }
    
    return loadData.cache;
  }

  function saveData()
  {
    try
    {
      window.top.name = toJson( loadData() );
    }
    catch (e)
    {

    }
  }

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
      return window.top && typeof window.top.name !== 'undefined';
    },

    init: function(options, success, failure) 
    {
      var promise = new Promise( this, success, failure );

      this.prefix = coalesce( options.prefix, this.name + '-' );

      promise.$bindTo( this.reload(), [this] );
      
      return promise;
    },

    reload: function(success, failure)
    {
      var promise = new Promise( this, success, failure );
      var prefix = this.prefix;
      var cache = new FastMap();
      var data = loadData();

      try
      {
        for (var rawKey in data)
        {
          if ( rawKey.substring( 0, prefix.length ) === prefix )
          {
            var rawValue = data[ rawKey ];
            var value = fromJson( rawValue );
            var key = this.decode( rawKey );

            cache.put( rawKey, value, key );
          }  
        }

        this.cache = cache;
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
      var keys = this.cache.keys;
      var data = loadData();

      for (var i = 0; i < keys.length; i++)
      {
        delete data[ keys[i] ];
      }

      this.cache.reset();

      saveData();

      promise.$success();
    },

    _put: function(key, value, rawKey, rawValue, promise)
    {
      var data = loadData();
      var previousValue = this.cache.get( rawKey );

      data[ rawKey ] = value;

      this.cache.put( rawKey, value, key );

      saveData();

      promise.$success( [key, value, previousValue] );
    },

    _remove: function(key, rawKey, value, promise)
    {
      var data = loadData();

      delete data[ rawKey ];

      this.cache.remove( rawKey );

      saveData();

      promise.$success( [value, key] );
    }

  }
});