
Stork.adapter('ie-userdata', 1.5, 
{
  valid: function() 
  {
    return def( document.body.addBehavior );
  },

  init: function(options, success, failure) 
  {
    var promise = new Promise( this, success, failure );

    var s = document.createElement('span');
    s.style.behavior = "url('#default#userData')";
    s.style.position = 'absolute';
    s.style.left = 10000;
    document.body.appendChild(s);

    this.store = s;
    this.store.load( this.name );

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

    var attributes = this.store.XMLDocument.firstChild.attributes;
    var cache = new FastMap();

    for (var i = 0; i < attributes.length; i++) 
    {
      try
      {
        var v = attributes[ i ];
        var rawKey = v.nodeName;
        var rawValue = v.nodeValue;
        var key = this.decode( rawKey );
        var value = fromJson( rawValue );

        cache.put( rawKey, value, key ); 
      }
      catch (e) 
      {
        // ignore
      }
    }

    this.cache = cache;
    this.loaded = true;
    this.finishReload( promise );

    return promise;
  },

  _get: function(key, rawKey, promise)
  {
    var rawValue = this.store.getAttribute( rawKey );

    if ( rawValue === null )
    {
      promise.$success( [undefined, key] );
    }
    else
    {
      var value = null;

      try
      {
        value = fromJson( rawValue );
      }
      catch (e)
      {
        promise.$failure( [e] );
      }

      if ( promise.$pending() )
      {
        this.cache.put( rawKey, value, key );

        promise.$success( [value, key] );
      }
    }
  },

  _destroy: function(promise)
  {
    var attributes = this.store.XMLDocument.firstChild.attributes;

    for (var i = 0; i < attributes.length; i++) 
    {
      this.store.removeAttribute( attributes[ i ].nodeName );
    }

    this.cache.reset();

    promise.$success();
  },

  _put: function(key, value, rawKey, rawValue, promise)
  {
    var previousValue = this.cache.get( rawKey );

    try
    {
      this.store.setAttribute( rawKey, rawValue );
    }
    catch (e)
    {
      promise.$failure( [key, value, e] );
    }

    if ( promise.$pending() )
    {
      this.cache.put( rawKey, value, key );

      promise.$success( [key, value, previousValue] );
    }
  },

  _remove: function(key, rawKey, value, promise)
  {
    this.store.removeAttribute( rawKey );
    this.cache.remove( rawKey );

    promise.$success( [value, key] );
  }

});