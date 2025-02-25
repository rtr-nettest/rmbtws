const gulp = require('gulp');
const sourcemaps = require('gulp-sourcemaps');
const uglify = require('gulp-uglify');
const babel = require('gulp-babel');
const concat = require('gulp-concat');
const order = require('gulp-order');
const header = require('gulp-header');

gulp.task('compilejs', gulp.series((done) => {
    //create concatenated version
    gulp.src('./src/*.js')
        .pipe(babel())
        .pipe(order([
            '**/Websockettest.js'
        ]))
        .pipe(concat('rmbtws.js'))
        .pipe(gulp.dest('dist/esm'))
        .pipe(header('var exports = {};\n'))
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
        .pipe(gulp.dest('dist/esm'))
        .pipe(header('var exports = {};\n'))
        .pipe(gulp.dest('dist'));

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
