var toJson = JSON.stringify;

var fromJson = JSON.parse;

function isFunc(x)
{
  return !!(x && x.constructor && x.call && x.apply);
}

function isObject(x)
{
  return typeof x === 'object' && x !== null;
}

function isNumber(x)
{
  return typeof x === 'number' && !isNaN(x);
}

function isArray(x)
{
  return x instanceof Array;
}

function isString(x)
{
  return typeof x === 'string';
}

function undef(x)
{
  return typeof x === 'undefined';
}

function def(x)
{
  return typeof x !== 'undefined';
}

function coalesce(a, b, c, d)
{
  if (def(a)) return a;
  if (def(b)) return b;
  if (def(c)) return c;
  return d;
}

function swap(arr, i, j)
{
  var temp = arr[i]; 
  arr[i] = arr[j]; 
  arr[j] = temp;
}

function noop()
{
}

function fn(func)
{
  return isFunc( func ) ? func : noop;
}

function fncoalesce(a, b)
{
  return isFunc( a ) ? a : (isFunc(b) ? b : noop);
}

function copy(from, to)
{
  for (var prop in from)
  {
    to[ prop ] = from[ prop ];
  }

  return to;
}

function S4() 
{
  return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
}

function uuid() 
{
    return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
}

function compareAdapters(a, b)
{
  var d = b.priority - a.priority;

  return d === 0 ? 0 : (d < 0 ? -1 : 1);
}

function $promise(methodName, func)
{
  return function()
  {
    var promise = new Promise( this, success, failure );

    if ( this.handlePending( this[ methodName ], arguments, promise ) ) 
    {
      return promise;
    }

    var args = Array.prototype.slice.call( arguments );
    args.pop(); // remove failure
    args.pop(); // remove success
    args.push( promise ); // add promise

    // Call the wrapped function
    func.apply( this, args );

    return promise;
  };
}

function getAdapter(adapterName)
{
  if ( adapterName )
  {
    for (var i = 0; i < Stork.adapters.length; i++) 
    {
      var adapt = Stork.adapters[i];

      if ( adapt.name === adapterName && adapt.definition.valid() )
      {
        return adapt;
      }
    }
  }

  if ( !getAdapter.chosen ) 
  {
    Stork.adapters.sort( compareAdapters );

    for (var i = 0; i < Stork.adapters.length; i++) 
    {
      var adapt = Stork.adapters[i];

      if ( adapt.definition.valid() )
      {
        return getAdapter.chosen = adapt;
      }
    }
  }

  return getAdapter.chosen;
}