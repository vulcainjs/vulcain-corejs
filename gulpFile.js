var os = require('os');
var Path = require('path');
var fs = require('fs');

var gulp = require("gulp"),
    ts = require("gulp-typescript"),
    merge = require('merge2'),
    fse = require('fs-extra'),
    typescript = require('typescript'),
    mocha = require('gulp-mocha'),
    istanbul = require('gulp-istanbul'),
    sourcemaps = require('gulp-sourcemaps'),
    concat = require("gulp-concat"),
    tslint = require("gulp-tslint"),
    typedoc = require("gulp-typedoc");

// Base root directory for source map
process.on('uncaughtException', console.error.bind(console));

gulp.task('default', ['compile-test']);

gulp.task('tslint', function () {
    return gulp.src('./src/**/*.ts')
        .pipe(tslint({formatter: "prose"}))
        .pipe(tslint.report())
        .on("error", function () {
            process.exit(1);
        });
    ;
});

// -----------------------------------
// Test
// -----------------------------------
gulp.task('test', ['istanbul:hook'], function () {
    return gulp.src(['./dist-test/**/*.js'])
        .pipe(mocha())
        // Creating the reports after tests ran
        .pipe(istanbul.writeReports());
        // Enforce a coverage of at least 90%
       // .pipe(istanbul.enforceThresholds({ thresholds: { global: 90 } }));
});

gulp.task("compile-test", ['compile-ts'], function () {
    var tsProject = ts.createProject('./test/tsconfig.json', { typescript });

    var tsResult = tsProject.src()
        .pipe(sourcemaps.init())
        .pipe(tsProject())
        .once("error", function () {
            this.once("finish", function () {
                process.exit(1)

            });
        });

    return tsResult.js
        .pipe(sourcemaps.write('../dist-test', {includeContent: false, sourceRoot:  "../test"}))
        .pipe(gulp.dest("dist-test"));
});

gulp.task("istanbul:hook", ['compile-test'], function () {
    return gulp.src(['./dist/**/*.js'])
    // Covering files
        .pipe(istanbul({ includeUntested: true }))
        // Force `require` to return covered files
        .pipe(istanbul.hookRequire());
});

// -----------------------------------
// Compilation
// -----------------------------------

// https://www.npmjs.com/package/gulp-typescript
gulp.task("compile-ts", [ 'clean'], function () {
    var tsProject = ts.createProject('./src/tsconfig.json', { typescript });

    var tsResult = tsProject.src()
        .pipe(sourcemaps.init())
        .pipe(tsProject())
        .once("error", function () {
            this.once("finish", function () {
                process.exit(1)
            });
        });

    return merge([
            tsResult.dts
                .pipe(gulp.dest('dist')),
            tsResult.js
                .pipe(sourcemaps.write('../dist', {includeContent: false, sourceRoot: "../src"}))
                .pipe(gulp.dest('dist'))
        ]
    );
});


// -----------------------------------
// Generate documentation
// -----------------------------------
gulp.task("doc", function () {
    return gulp
        .src(["src/index.ts"])
        .pipe(typedoc({
            "emitDecoratorMetadata": true,
            "experimentalDecorators": true,
            "module": "commonjs",
            "moduleResolution": "node",
            "target": "es6",
            "excludePrivate": true,
            out: "ts-doc/",
            name: "Vulcain corejs"
        }))
        ;
});

gulp.task('clean', function (done) {
    fse.remove('dist', done);
});
