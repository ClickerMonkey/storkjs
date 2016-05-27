'use strict';

var gulp = require('gulp');
var sourcemaps = require('gulp-sourcemaps');
var plugins = require('gulp-load-plugins')();
var gutil = require('gulp-util');
var shell = require('gulp-shell');
var size = require('gulp-check-filesize');

var core =
[
  './src/header.js',
  './src/lib/functions.js',
  './src/lib/Stork.js',
  './src/lib/Promise.js',
  './src/lib/FastMap.js',
  './src/lib/extending.js',
  './src/plugins/*.js',
  './src/adapters/*.js',
  './src/footer.js'
];

var builds =
{
  default:
  {
    filename: 'stork.js',
    minified: 'stork.min.js',
    output: './build/',
    include: core
  }
};

var executeMinifiedBuild = function(props)
{
  return function() {
    return gulp
      .src( props.include )
      .pipe( sourcemaps.init() )
        .pipe( plugins.concat( props.minified ) )
        .pipe( plugins.uglify().on('error', gutil.log) )
      .pipe( sourcemaps.write('.') )
      .pipe( size({enableGzip: true}) )
      .pipe( gulp.dest( props.output ) )
    ;
  };
};

var executeBuild = function(props)
{
  return function() {
    return gulp
      .src( props.include )
      .pipe( plugins.concat( props.filename ) )
      .pipe( size({enableGzip: true}) )
      .pipe( gulp.dest( props.output ) )
    ;
  };
};

gulp.task( 'docs', shell.task(['./node_modules/.bin/jsdoc -c jsdoc.json']));

gulp.task( 'js:default:min',    executeMinifiedBuild( builds.default ) );
gulp.task( 'js:default',        executeBuild( builds.default ) );

gulp.task( 'js:min', ['js:default:min']);
gulp.task( 'js', ['js:default']);
gulp.task( 'default', ['js:min', 'js']);
