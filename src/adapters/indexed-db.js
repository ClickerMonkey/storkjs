Stork.adapter('indexed-db', 5, function()
{

  var getIDB = function() 
  {
    return window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.oIndexedDB || window.msIndexedDB;
  };

  var getIDBTransaction = function() 
  {
    return window.IDBTransaction || window.webkitIDBTransaction || window.mozIDBTransaction || window.oIDBTransaction || window.msIDBTransaction;
  };

  var getIDBKeyRange = function() 
  {
    return window.IDBKeyRange || window.webkitIDBKeyRange || window.mozIDBKeyRange || window.oIDBKeyRange || window.msIDBKeyRange;
  };

  var DATABASE_NAME = 'stork';
  var DATABASE_VERSION = 3;
  var READ_WRITE = (getIDBTransaction() && 'READ_WRITE' in getIDBTransaction()) ? getIDBTransaction().READ_WRITE : 'readwrite';

  return {

    valid: function() 
    {
      return !!getIDB();
    },

    init: function(options, success, failure)
    {
      var promise = new Promise( this, success, failure );

      var stork = this;
      var factory = getIDB();
      var request = factory.open( this.name, DATABASE_VERSION );

      request.onerror = function(e)
      {
        promise.$failure( [e] );
      };

      // First started or it needs a version upgrade
      request.onupgradeneeded = function()
      {
        stork.db = request.result;
        stork.db.createObjectStore( stork.name, { keyPath: this.key } );
      };

      // Database is ready for use
      request.onsuccess = function(event)
      {
        stork.db = request.result;

        if ( stork.lazy )
        {
          stork.finishInitialization( promise, [stork] );
        }
        else
        {
          promise.$bindTo( stork.reload(), [stork] );
        }
      };

      return promise;
    },

    reload: function(success, failure)
    {
      var promise = new Promise( this, success, failure );

      var stork = this;
      var objectStore = this.db.transaction( this.name ).objectStore( this.name );
      var cursor = objectStore.openCursor();
      var cache = new FastMap();

      cursor.onsuccess = function(e)
      {
        var result = cursor.result;

        if (result)
        {
          var rawKey = result.key;
          var value = result.value;
          var key = stork.decode( rawKey );

          cache.put( rawKey, value, key );

          result['continue']();
        }
        else
        {
          stork.cache.overwrite( cache );
          stork.loaded = true;
          stork.finishReload( promise, [stork.cache.values, stork.cache.okeys] );
        }
      };

      cursor.onerror = function(e)
      {
        promise.$failure( [keys, e] );
      };

      return promise;
    },

    _destroy: function(promise)
    {
      var stork = this;
      var objectStore = this.db.transaction( this.name, READ_WRITE ).objectStore( this.name );

      objectStore.transaction.oncomplete = function()
      {
        stork.cache.reset();

        promise.$success();
      };

      objectStore.transaction.onabort = function(e)
      {
        promise.$failure( [e] );
      };

      objectStore.clear();
    },

    _get: function(key, rawKey, promise)
    {
      var stork = this;
      var objectStore = this.db.transaction( this.name ).objectStore( this.name );
      var request = objectStore.get( rawKey );

      request.onsuccess = function(e)
      {
        if ( request.result === undefined )
        {
          promise.$success( [undefined, key] );
        }
        else
        {
          var value = request.result;

          stork.cache.put( rawKey, value, key );

          promise.$success( [value, key] );          
        }
      };

      request.onerror = function()
      {
        promise.$failure( [key, request.error] );
      };
    },

    _put: function(key, value, rawKey, rawValue, promise)
    {
      var stork = this;
      var objectStore = this.db.transaction( this.name, READ_WRITE ).objectStore( this.name );

      objectStore.transaction.oncomplete = function()
      {
        var previousValue = stork.cache.get( rawKey );

        stork.cache.put( rawKey, value, key );

        promise.$success( [key, value, previousValue] );
      }; 

      objectStore.transaction.onabort = function(e)
      {
        promise.$failure( [key, value, e] );
      };

      objectStore.put( value, rawKey );
    },

    _remove: function(key, rawKey, value, promise)
    {  
      var stork = this;
      var objectStore = this.db.transaction( this.name, READ_WRITE ).objectStore( this.name );

      objectStore.transaction.oncomplete = function()
      {
        stork.cache.remove( rawKey );

        promise.$success( [value, key] );
      }; 

      objectStore.transaction.onabort = function(e)
      {
        promise.$failure( [key, e] );
      };

      objectStore['delete']( rawKey );
    },

    _size: function(promise)
    {
      var stork = this;
      var objectStore = this.db.transaction( this.name, READ_WRITE ).objectStore( this.name );
      var request = objectStore.count();

      request.onsuccess = function()
      {
        promise.$success( [request.result] );
      };

      request.onerror = function(e)
      {
        promise.$failure( [request.error] );
      };
    }

    // TODO getMany, removeMany

  };

});