const gulp = require('gulp');
const sourcemaps = require('gulp-sourcemaps');
const uglify = require('gulp-uglify');
const babel = require('gulp-babel');
const rename = require('gulp-rename');
const concat = require('gulp-concat');
const order = require('gulp-order');
const browserify = require('browserify');
const log = require('gulplog');
const tap = require('gulp-tap');

gulp.task('compilejs', gulp.series((done) => {
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

    gulp.src('./dist/*.js', {read: false})
        .pipe(tap(function (file) {

        log.info('bundling ' + file.path);

        // replace file contents with browserify's bundle stream
        file.contents = browserify(file.path, {debug: true}).bundle();

        }))
        .pipe(gulp.dest('dist/browser'));

    //note: we can't do both at once due to problems with
    //preserveComments : 'license'; which does not work
    //with the concatenated file
    done();
}));

gulp.task('watchForChanges', gulp.series((done) => {
    gulp.watch('./src/**/*.js', gulp.series('compilejs'));
    done();
}));

gulp.task('watch', gulp.series('compilejs', 'watchForChanges'));
gulp.task('build', gulp.series('compilejs'));

gulp.task('default', gulp.series('compilejs'));
