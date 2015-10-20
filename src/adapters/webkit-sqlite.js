
Stork.adapter('webkit-sqlite', 6, function()
{
  var DATABASE_NAME = 'stork';

  var SQL_CREATE = 'CREATE TABLE IF NOT EXISTS {0} (id TEXT PRIMARY KEY, value TEXT)';
  var SQL_SELECT  = 'SELECT value FROM {0} WHERE id = ?';
  var SQL_SELECT_ALL = 'SELECT id, value FROM {0}';
  var SQL_SELECT_MANY = 'SELECT id, value FROM {0} WHERE id IN ({1})';
  var SQL_INSERT = 'INSERT OR REPLACE INTO {0} (id, value) VALUES (?, ?)';
  var SQL_DELETE = 'DELETE FROM {0} WHERE id = ?';
  var SQL_COUNT = 'SELECT COUNT(*) as count FROM {0}';
  var SQL_DESTROY = 'DELETE FROM {0}';
  var SQL_DELETE_MANY = 'DELETE FROM {0} WHERE id IN ({1})';

  function streplace(str, arr)
  {
    return str.replace(/\{(\d+)\}/g, function(match, index)
    {
      index = parseInt( index );

      if ( isNaN( index ) || index < 0 || index >= arr.length ) 
      {
        return match;
      }

      return arr[ index ];
    });
  }

  return {

    valid: function() 
    {
      return !!window.openDatabase;
    },

    init: function(options, success, failure) 
    {
      var promise = new Promise( this, success, failure );

      var databaseName = coalesce( options.database, DATABASE_NAME );
      var databaseSize = coalesce( options.size, 65536 );
      var databaseVersion = coalesce( options.version, '1.0' );

      var stork = this;

      var onFailure = function(tx, error) 
      {
        promise.$failure( [error] );
      };
      var onTransactionForCreate = function(tx) 
      {
        tx.executeSql( stork.SQL_CREATE, [], onCreate, onFailure );
      };
      var onCreate = function(tx, results) 
      {
        if ( stork.lazy )
        {
          stork.finishInitialization( promise, [stork] );
        }
        else
        {
          promise.$bindTo( stork.reload(), [stork] );
        }
      };

      this.SQL_CREATE     = streplace( SQL_CREATE, [this.name] );
      this.SQL_SELECT     = streplace( SQL_SELECT, [this.name] );
      this.SQL_SELECT_ALL = streplace( SQL_SELECT_ALL, [this.name] );
      this.SQL_INSERT     = streplace( SQL_INSERT, [this.name] );
      this.SQL_DELETE     = streplace( SQL_DELETE, [this.name] );
      this.SQL_DESTROY    = streplace( SQL_DESTROY, [this.name] );
      this.SQL_COUNT      = streplace( SQL_COUNT, [this.name] );

      this.db = openDatabase( databaseName, databaseVersion, databaseName, databaseSize );
      this.db.transaction( onTransactionForCreate, onFailure );
      
      return promise;
    },

    reload: function(success, failure)
    {
      var promise = new Promise( this, success, failure );
      var stork = this;

      var onFailure = function(tx, error) 
      {
        promise.$failure( [error] );
      };
      var onTransactionForSelect = function(tx) 
      {
        tx.executeSql( stork.SQL_SELECT_ALL, [], onResults, onFailure );
      };
      var onResults = function(tx, results) 
      {
        var cache = new FastMap();
        try 
        {
          for (var i = 0; i < results.rows.length; i++) 
          {
            var record = results.rows[ i ];
            var value = fromJson( record.value );
            var key = fromJson( record.id );

            cache.put( record.id, value, key );
          }

          stork.cache = cache;
          stork.loaded = true;
        }
        catch (e) 
        {
          promise.$failure( [e] );
        }

        stork.finishReload( promise );
      };

      this.db.readTransaction( onTransactionForSelect, onFailure );

      return promise;
    },

    _get: function(key, rawKey, promise)
    {
      var stork = this;

      var onFailure = function(tx, error) 
      {
        promise.$failure( [key, error] );
      };
      var onTransaction = function(tx)
      {
        tx.executeSql( stork.SQL_SELECT, [rawKey], onResult, onFailure );
      };
      var onResult = function(tx, results)
      {
        var value = undefined;
        try
        {
          var first = results.rows[ 0 ];

          if ( first && first.value !== undefined )
          {
            value = fromJson( first.value );
          }
        }
        catch (e)
        {
          promise.$failure( [key, e] );
        }

        if ( promise.$pending() )
        {
          if ( value !== undefined )
          {
            stork.cache.put( rawKey, value, key );

            promise.$success( [value, key] );
          }
          else
          {
            promise.$success( [undefined, key] );
          }
        }
      };

      this.db.readTransaction( onTransaction, onFailure );
    },

    _destroy: function(promise)
    {
      var stork = this;

      var onTransaction = function(tx) 
      {
        tx.executeSql( stork.SQL_DESTROY, [], onSuccess, onFailure );
      };
      var onSuccess = function(tx, results) 
      {
        stork.cache.reset();

        promise.$success();
      };
      var onFailure = function(tx, error) 
      {
        promise.$failure( [error] );
      };

      this.db.transaction( onTransaction, onFailure );
    },

    _put: function(key, value, rawKey, rawValue, promise)
    {
      var stork = this;
      
      var onTransaction = function(tx) 
      {
        tx.executeSql( stork.SQL_INSERT, [rawKey, rawValue], onSuccess, onFailure );
      };
      var onSuccess = function(tx, results) 
      {
        var previousValue = stork.cache.get( rawKey );

        stork.cache.put( rawKey, value );

        promise.$success( [key, value, previousValue] );
      };
      var onFailure = function(tx, error) 
      {
        promise.$failure( [key, value, error] );
      };

      this.db.transaction( onTransaction, onFailure );
    },

    _remove: function(key, rawKey, value, promise)
    {
      var stork = this;
      
      var onTransaction = function(tx) 
      {
        tx.executeSql( stork.SQL_DELETE, [rawKey], onSuccess, onFailure );
      };
      var onSuccess = function(tx, results) 
      {
        stork.cache.remove( rawKey );

        promise.$success( [value, key] );
      };
      var onFailure = function(tx, error) 
      {
        promise.$failure( [key, error] );
      };

      this.db.transaction( onTransaction, onFailure );
    },

    _size: function(promise)
    {
      var stork = this;

      var onFailure = function(tx, error) 
      {
        promise.$failure( [error] );
      };
      var onTransaction = function(tx)
      {
        tx.executeSql( stork.SQL_COUNT, [], onCount, onFailure );
      };
      var onCount = function(tx, results)
      {
        promise.$success( [results.rows[0].count] );
      };

      this.db.readTransaction( onTransaction, onFailure );
    },

    batch: function(records, success, failure)
    {
      var promise = new Promise( this, success, failure );

      if ( this.handlePending( this.batch, arguments, promise ) )
      {
        return promise;
      }

      var stork = this;
      var keyName = this.key;
      var successful = 0;
      var converted = [];

      try
      {
        for (var i = 0; i < records.length; i++)
        {
          var value = records[ i ];
          var key = value[ keyName ];

          if ( undef(key) ) 
          {
            key = value[ keyName ] = uuid();
          }

          converted.push(
          {
            value: value,
            key: key,
            rawKey: toJson( key ), 
            rawValue: toJson( value )
          });
        }  
      }
      catch (e)
      {
        promise.$failure( [records, successful, e] );

        return promise;
      }

      var onTransaction = function(tx) 
      { 
        for (var i = 0; i < converted.length; i++)
        {
          var record = converted[ i ];

          tx.executeSql( stork.SQL_INSERT, [record.rawKey, record.rawValue], onSuccess, onFailure );
        }
      };
      var onSuccess = function(tx, results) 
      {
        if ( ++successful === records.length && promise.$pending() )
        {
          for (var i = 0; i < converted.length; i++)
          {
            var record = converted[ i ];

            stork.cache.put( record.rawKey, record.value, record.key );
          }

          promise.$success( [records] );
        }
      };
      var onFailure = function(tx, error) 
      {
        promise.$failure( [records, successful, error] );
      };

      this.db.transaction( onTransaction, onFailure );

      return promise;
    },

    removeMany: function(keys, success, failure)
    {
      var promise = new Promise( this, success, failure );

      if ( this.handlePending( this.removeMany, arguments, promise ) )
      {
        return promise;
      }

      var stork = this;
      var rawKeys = [];
      var values = []; 
      var binder = [];
      var query = '';

      var onTransaction = function(tx) 
      {
        tx.executeSql( query, rawKeys, onSuccess, onFailure );
      };
      var onSuccess = function(tx, results) 
      {
        for (var i = 0; i < rawKeys.length; i++) 
        {
          stork.cache.remove( rawKeys[ i ] );
        }

        promise.$success( [values, keys] );
      };
      var onFailure = function(tx, error) 
      {
        promise.$failure( [values, 0, error] );
      };

      try
      {
        for (var i = 0; i < keys.length; i++) 
        {
          var key = toJson( keys[ i ] );

          if ( this.cache.has( key ) )
          {
            rawKeys[ i ] = key;
            values[ i ] = this.cache.get( key );
            binder[ i ] = '?';
          }
        }

        query = streplace( SQL_DELETE_MANY, [this.name, binder.join(',')] );
      }
      catch (e)
      {
        promise.$failure( [values, e] );
      }

      if ( promise.$pending() )
      {
        this.db.transaction( onTransaction, onFailure );
      }

      return promise;
    },

    getMany: function(keys, success, failure)
    {
      var promise = new Promise( this, success, failure );

      if ( this.handlePending( this.removeMany, arguments, promise ) )
      {
        return promise;
      }

      var stork = this;
      var rawKeys = [];
      var keyToValueIndex = [];
      var values = [];
      var binder = [];
      var query = '';

      var onTransaction = function(tx) 
      {
        tx.executeSql( query, rawKeys, onSuccess, onFailure );
      };
      var onSuccess = function(tx, results) 
      {
        for (var i = 0; i < results.rows.length; i++)
        {
          var r = results.rows[ i ];

          for (var k = 0; k < rawKeys.length; k++)
          {
            if ( rawKeys[ k ] === r.id )
            {
              values[ keyToValueIndex[ k ] ] = fromJson( r.value );
            }
          }
        }

        promise.$success( [values, keys] );
      };
      var onFailure = function(tx, error) 
      {
        promise.$failure( [keys, error] );
      };

      try
      {
        for (var i = 0; i < keys.length; i++) 
        {
          var key = toJson( keys[ i ] );

          if ( this.cache.has( key ) )
          {
            values[ i ] = this.cache.get( key );
          }
          else
          {
            rawKeys.push( key );
            keyToValueIndex.push( i );
            binder.push( '?' );
          }
        }

        query = streplace( SQL_SELECT_MANY, [this.name, binder.join(',')] );          
      }
      catch (e)
      {
        promise.$failure( [values, e] );
      }

      if ( promise.$pending() )
      {
        if ( rawKeys.length )
        {
          this.db.transaction( onTransaction, onFailure );
        }
        else
        {
          promise.$success( [values, keys] );
        }
      }

      return promise;
    }

  }
});