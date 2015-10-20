'use strict';

function TestBase(adapter, prepend, hasBackend)
{

  module( adapter );

  var adapterImpl = Stork.getAdapter( adapter );

  if ( adapterImpl.name !== adapter )
  {
    test('adapter selection', function()
    {
      ok( false, 'this adapter is not available in your browser!' );

    });

    return;
  }

  var db = null;
  var options0 = {name: prepend + 'test0', adapter: adapter};
  var options1 = {name: prepend + 'test1', adapter: adapter, key:'key'};
  var options2 = {name: prepend + 'test2', adapter: adapter};

  function fail(done) 
  {
    return function(e) 
    {
      console.log( e );
      ok( false, 'fail' );
      done();
    };
  }

  function success(done) 
  {
    return function() 
    {
      ok( true, 'success' );
      done();
    };
  }

  // Execute in the following order:
  QUnit.config.reorder = false;

  // Functions: init, get, destroy, save, batch, put, remove, removeMany, each, size, all
  // Test: Pending, Changing Key, Multiple Databases, Promises

  test('initialization', function(assert)
  {
    var done = assert.async();

    db = new Stork( options0 );
    db.initializing
      .then(function()
      {
        equal( db.options, options0, 'matching options' );
        equal( db.key, 'id', 'correct key' );
        equal( db.name, prepend + 'test0', 'correct name' );
        equal( db.initialized, true, 'mark as initialized' );
        done();
      })
      .error( fail( done ) )
    ;
  });

  test('then', function(assert)
  {
    db.then(function()
      {
        strictEqual( db, this, 'this is correct' );
      })
    ;
  });

  test('get promise', function(assert)
  {
    ok( db.get('fake') instanceof Stork.Promise, 'promise returned' );
  });

  test('save promise', function(assert)
  {
    ok( db.save({x: 5}) instanceof Stork.Promise, 'promise returned' );
  });

  test('batch promise', function(assert)
  {
    ok( db.batch([{x: 5}]) instanceof Stork.Promise, 'promise returned' );
  });

  test('put promise', function(assert)
  {
    ok( db.put('meow', [{x: 5}]) instanceof Stork.Promise, 'promise returned' );
  });

  test('remove promise', function(assert)
  {
    ok( db.remove('meow') instanceof Stork.Promise, 'promise returned' );
  });

  test('remove many promise', function(assert)
  {
    ok( db.removeMany(['ow', 'now', 'brown', 'cow']) instanceof Stork.Promise, 'promise returned' );
  });

  test('each this', function(assert)
  {
    strictEqual( db, db.each(function(){}), 'this is correct' );
  })

  test('destroy promise', function(assert)
  {
    ok( db.destroy() instanceof Stork.Promise, 'promise returned' );
  });

  test('size promise', function(assert)
  {
    ok( db.size() instanceof Stork.Promise, 'promise returned' );
  });

  test('all promise', function(assert)
  {
    ok( db.all() instanceof Stork.Promise, 'promise returned' );
  });

  test('promises', function(assert)
  {
    var KEY = 42;
    var VALUE = 'Meaning of Life';

    var done = assert.async();

    db.put( KEY, VALUE )
      .then(function(key, value) 
      {
        strictEqual( key, KEY, 'put key matches' );
        strictEqual( value, VALUE, 'put value matches' );

        return this.get( KEY );
      })
      .then(function(value, key) 
      {
        strictEqual( value, VALUE, 'get value matches' );

        return this.remove( KEY );
      })
      .then(function(removedValue, removedKey) 
      {
        strictEqual( removedValue, VALUE, 'removed value matches' );

        return this.get( KEY );
      })
      .then(function(value, key) 
      {
        strictEqual( value, void 0, 'value removed' );
        done();
      })
      .error( fail( done ) )
    ;
  });

  test('put same key', function(assert)
  {
    var KEY = 41;
    var VALUE = 'Meaning of Life - 1';
    var done = assert.async();

    db.then(function()
      {
        return this.put( KEY, VALUE );
      })
      .then(function()
      {
        return this.size();
      })
      .then(function(count)
      {
        equal( count, 1, 'one item' );

        return this.put( KEY, VALUE );
      })
      .then(function()
      {
        return this.size();
      })
      .then(function(count)
      {
        equal( count, 1, 'still one item' );

        return this.destroy();
      })
      .then( success( done ) )
      .error( fail( done ) )
    ;
  });

  if ( hasBackend )
  {
    test('get lazy', function(assert)
    {
      var db = new Stork({name: prepend + 'getlazy', adapter: adapter, lazy: true});

      var KEY = 40;
      var VALUE = 'Over the Hill';
      var done = assert.async();

      db.then(function()
        {
          return this.put( KEY, VALUE );
        })
        .then(function()
        {
          return new Stork({name: prepend + 'getlazy', adapter: adapter, lazy: true}).initializing;
        })
        .then(function()
        {
          equal( this.cache.size(), 0, 'cache empty' );
          notStrictEqual( this, db, 'this is correct' );

          return this.get( KEY );
        })
        .then(function(value)
        {
          equal( value, VALUE, 'values equal' );

          return this.size();
        })
        .then(function(count)
        {
          equal( count, 1, 'has one value loaded!' );
          
          return this.destroy();
        })
        .then( success( done ) )
        .error( fail( done ) )
      ;
    });
  }

  test('get failure', function(assert)
  {
    var done = assert.async();

    var key = {};
    key.parent = key;

    db.get( key )
      .then( fail( done ), success( done ) )
    ;
  });

  test('save failure', function(assert)
  {
    var done = assert.async();

    var record = {};
    record.id = record;

    db.save( record )
      .then( fail( done ), success( done ) )
    ;
  });

  test('put failure', function(assert)
  {
    var done = assert.async();

    var key = {};
    key.parent = key;

    db.put( key, true )
      .then( fail( done ), success( done ) )
    ;
  });

  test('remove failure', function(assert)
  {
    var done = assert.async();

    var key = {};
    key.parent = key;

    db.remove( key )
      .then( fail( done ), success( done ) )
    ;
  });

  test('remove many failure', function(assert)
  {
    var done = assert.async();

    var key0 = {}; key0.parent = key0;
    var key1 = {}; key1.parent = key1;

    db.removeMany( [key0, key1] )
      .then( fail( done ), success( done ) )
    ;
  });

  test('saving records', function(assert)
  {
    var RECORD0 = {id: 24, name: 'storkjs'};
    var RECORD1 = {name: 'qunit'};

    var done0 = assert.async();
    var done1 = assert.async();

    db.save( RECORD0 )
      .then(function(record)
      {
        strictEqual( record, RECORD0, 'correct record saved' );

        return this.get( record.id );
      })
      .then(function(record)
      {
        strictEqual( record, RECORD0, 'correct record returned' );

        return this.remove( record.id );
      })
      .then(function(removedValue)
      {
        strictEqual( removedValue, RECORD0, 'correct record removed' );

        return this.get( removedValue.id );
      })
      .then(function(value)
      {
        strictEqual( value, void 0, 'no record found' );
        done0();
      })
      .error( fail( done0 ) );
    ;

    ok( RECORD1.id === void 0, 'no record id' );

    db.save( RECORD1 )
      .then(function(record)
      {
        strictEqual( record, RECORD1, 'correct record saved' );
        notStrictEqual( record.id, void 0, 'record id provided: ' + record.id );

        return this.remove( record.id );
      })
      .then(function(removedValue)
      {
        strictEqual( removedValue, RECORD1, 'correct record removed' );
        done1();
      })
      .error( fail( done1 ) )
    ;
  });

  if ( hasBackend )
  {
    test('lazy size', function(assert)
    {
      var db = new Stork({name: prepend + 'lazysize', adapter: adapter});

      var done = assert.async();

      var records = [
        {name: 'Tom'},
        {name: 'John'},
        {name: 'Roy'}
      ];

      db.batch( records )
        .then(function() 
        {
          return new Stork({name: prepend + 'lazysize', adapter: adapter, lazy: true}).initializing;
        })
        .then(function()
        {
          notStrictEqual( db, this, 'this is correct #1' );

          return this.size();
        })
        .then(function(count)
        {
          notStrictEqual( db, this, 'this is correct #2' );
          equal( count, 3, 'size is correct' );

          if ( !this.loaded )
          {
            equal( this.cache.size(), 0, 'cache is empty' ); 
          }

          return this.destroy();
        })
        .then(function()
        {
          notStrictEqual( db, this, 'this is correct #3' );

          return this.size();
        })
        .then(function(count)
        {
          equal( count, 0, 'size is correct, stork is empty' );
          done();
        })
        .error( fail( done ) )
      ;

    });
  }

  if ( hasBackend )
  {
    test('lazy destroy', function(assert)
    {
      var db = new Stork({name: prepend + 'lazydestroy', adapter: adapter, lazy: true});

      var done = assert.async();

      var records = [
        {name: 'Tom'},
        {name: 'John'},
        {name: 'Roy'}
      ];

      db.batch( records )
        // ensure this database has 3 records, and return a new database to work with
        .then(function(recordsSaved) 
        {
          equal( recordsSaved.length, 3, 'records inserted' );

          return new Stork({name: prepend + 'lazydestroy', adapter: adapter, lazy: true}).initializing;
        })
        // destroy the new database
        .then(function()
        {
          notStrictEqual( db, this, 'this is correct #1' );

          return this.destroy();
        })
        // size the new database
        .then(function()
        {
          notStrictEqual( db, this, 'this is correct #2' );

          return this.size()
        })
        .then(function(count)
        {
          equal( count, 0, 'records lazily destroyed' );
          done();
        })
        .error( fail( done ) )
      ;

    });

    test('lazy reload', function(assert)
    {
      var db = new Stork({name: prepend + 'lazyreload', adapter: adapter, lazy: true});

      var done = assert.async();

      var records = [
        {name: 'Tom'},
        {name: 'John'},
        {name: 'Roy'}
      ];

      db.then(function()
        {
          return this.batch( records ); 
        })
        // ensure this database has 3 records, and return a new database to work with
        .then(function(recordsSaved)
        {
          equal( recordsSaved.length, 3, 'records inserted' );

          return new Stork({name: prepend + 'lazyreload', adapter: adapter, lazy: true}).initializing;
        })
        .then(function()
        {
          equal( this.cache.size(), 0, 'cache is empty' );
          notStrictEqual( db, this, 'this is correct #1' );

          return this.reload();
        })
        .then(function(values, keys)
        {
          equal( keys.length, 3, 'reload worked' );
          equal( this.loaded, true, 'marked as loaded' );

          return this.destroy();
        })
        .then( success( done ) )
        .error( fail( done ) )
      ;

    });
  }


}