const gulp = require('gulp');
const sourcemaps = require('gulp-sourcemaps');
const uglify = require('gulp-uglify');
const babel = require('gulp-babel');
const concat = require('gulp-concat');
const order = require('gulp-order');
const header = require('gulp-header');

const compilejs = () => {
    //create concatenated version
    const esmBuild = gulp.src('./src/*.js')
        .pipe(babel({
            presets: ['@babel/preset-env']
        }))
        .pipe(order([
            '**/Websockettest.js'
        ]))
        .pipe(concat('rmbtws.js'))
        .pipe(gulp.dest('dist/esm'));

    // Browser Version erstellen
    const browserBuild = esmBuild
        .pipe(header('var exports = {};\n'))
        .pipe(gulp.dest('dist'));

    // Minifizierte Version erstellen
    const minifiedBuild = gulp.src('./src/*.js')
        .pipe(sourcemaps.init())
        .pipe(babel({
            presets: ['@babel/preset-env']
        }))
        .pipe(order([
            '**/Websockettest.js'
        ]))
        .pipe(uglify({
            output: {
                comments: 'some'
            }
        }))
        .pipe(concat('rmbtws.min.js'))
        .pipe(sourcemaps.write('./'))
        .pipe(gulp.dest('dist/esm'))
        .pipe(header('var exports = {};\n'))
        .pipe(gulp.dest('dist'));

    //note: we can't do both at once due to problems with
    //preserveComments : 'license'; which does not work
    //with the concatenated file
    return Promise.all([esmBuild, browserBuild, minifiedBuild]);
};

// Watch-Task
const watchForChanges = () => {
    return gulp.watch('./src/**/*.js', compilejs);
};

// Task definitions
exports.compilejs = compilejs;
exports.watch = gulp.series(compilejs, watchForChanges);
exports.build = compilejs;
exports.default = compilejs;
