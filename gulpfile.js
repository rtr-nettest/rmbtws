const gulp = require('gulp');
const sourcemaps = require('gulp-sourcemaps');
const uglify = require('gulp-uglify');
const babel = require('gulp-babel');
const rename = require('gulp-rename');
const concat = require('gulp-concat');
const order = require('gulp-order');

gulp.task('compilejs', () => {
    //create concatenated version
    gulp.src('./src/*.js')
        .pipe(babel())
        .pipe(order([
            '**/Websockettest.js'
        ]))
        .pipe(concat('rmbtws.js'))
        .pipe(gulp.dest('dist'));

    //create minified version
    gulp.src('./src/*.js')
        .pipe(sourcemaps.init())
        .pipe(babel())
        .pipe(order([
            '**/Websockettest.js'
        ]))
        .pipe(uglify({
            preserveComments: 'license'
        }))
        .pipe(concat('rmbtws.min.js'))
        .pipe(sourcemaps.write('./'))
        .pipe(gulp.dest('dist'));

    //note: we can't do both at one due to problems with
    //preserveComments : 'license'; which does not work
    //with the concatenated file
});

gulp.task('watchForChanges', () => {
    gulp.watch('./src/**/*.js',['compilejs']);
});

gulp.task('watch', ['compilejs', 'watchForChanges']);
gulp.task('build', ['compilejs']);

gulp.task('default', ['compilejs']);
