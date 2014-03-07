/**
 * @description Google Chart Api Directive Module for AngularJS
 * @version 0.0.8
 * @author Nicolas Bouillon <nicolas@bouil.org>
 * @author GitHub contributors
 * @license MIT
 * @year 2013
 */
(function (document, window) {
  'use strict';

  angular.module('googlechart', [])

    .constant('googleChartApiConfig', {
      version: '1',
      optionalSettings: {
        packages: ['controls']
      }
    })


    .factory('googleChartApiPromise', ['$rootScope', '$q', 'googleChartApiConfig', function ($rootScope, $q, apiConfig) {
      var apiReady = $q.defer();
      (function () {
        // override callback function
        var settings = {
          callback: function () {
            var oldCb = apiConfig.optionalSettings.callback;
            $rootScope.$apply(function () {
              apiReady.resolve();
            });

            if (angular.isFunction(oldCb)) {
              oldCb.call(this);
            }
          }
        };

        settings = angular.extend({}, apiConfig.optionalSettings, settings);

        window.google.load('visualization', apiConfig.version, settings);
      })();

      return apiReady.promise;
    }])
    .directive('googleChart', ['$timeout', '$window', '$rootScope', 'googleChartApiPromise', function ($timeout, $window, $rootScope, googleChartApiPromise) {
      return {
        restrict: 'A',
        scope: {
          chart: '=',
          onRangeUpdate: '=',
          onReady: '&',
          select: '&'
        },
        template: '<select><option ng-repeat="category in chart.categories">{{category}}</option></select>' +
          '<div id="chart_div"></div><div style="height:50px" id="rangefilter_div"></div>',
        link: function ($scope, $elm, $attr) {
          // Watches, to refresh the chart when its data, title or dimensions change
          $scope.$watch('chart', function () {
            drawAsync();
          }, true); // true is for deep object equality checking



          // Redraw the chart if the window is resized
          $rootScope.$on('resizeMsg', function (e) {
            $timeout(function () {
              // Not always defined yet in IE so check
              if($scope.chartWrapper) {
                drawAsync();
              }
            });
          });

          function applyFormat(formatType, formatClass, dataTable) {

            if (typeof($scope.chart.formatters[formatType]) != 'undefined') {
              if ($scope.formatters[formatType] == null) {
                $scope.formatters[formatType] = new Array();

                if (formatType === 'color') {
                  for (var cIdx = 0; cIdx < $scope.chart.formatters[formatType].length; cIdx++) {
                    var colorFormat = new formatClass();

                    for (var i = 0; i < $scope.chart.formatters[formatType][cIdx].formats.length; i++) {
                      var data = $scope.chart.formatters[formatType][cIdx].formats[i];

                      if (typeof(data.fromBgColor) != 'undefined' && typeof(data.toBgColor) != 'undefined')
                        colorFormat.addGradientRange(data.from, data.to, data.color, data.fromBgColor, data.toBgColor);
                      else
                        colorFormat.addRange(data.from, data.to, data.color, data.bgcolor);
                    }

                    $scope.formatters[formatType].push(colorFormat)
                  }
                } else {

                  for (var i = 0; i < $scope.chart.formatters[formatType].length; i++) {
                    $scope.formatters[formatType].push(new formatClass(
                      $scope.chart.formatters[formatType][i])
                    );
                  }
                }
              }


              //apply formats to dataTable
              for (var i = 0; i < $scope.formatters[formatType].length; i++) {
                if ($scope.chart.formatters[formatType][i].columnNum < dataTable.getNumberOfColumns())
                  $scope.formatters[formatType][i].format(dataTable, $scope.chart.formatters[formatType][i].columnNum);
              }


              //Many formatters require HTML tags to display special formatting
              if (formatType === 'arrow' || formatType === 'bar' || formatType === 'color')
                $scope.chart.options.allowHtml = true;
            }
          }

          function getCategoryTable(category, dataTable){
            if (category === 'Month'){
              var getMonthYear = function getMonthYear(someDate){
                var n = new Date(someDate.getFullYear(), someDate.getMonth(), 1);
                return n;
              };
              var result = google.visualization.data.group(
                dataTable,
                [{column: 0, modifier: getMonthYear, type: 'date'}],
                [{'column': 1, 'aggregation': google.visualization.data.sum, 'type': 'number'},
                  {'column': 2, 'aggregation': google.visualization.data.sum, 'type': 'number'}]
              );
              var formatter_month = new google.visualization.DateFormat({pattern: 'MMM yyyy'});
              formatter_month.format(result, 0);
              return result;
            }
            else if (category === 'Week'){
              var getFirstDateOfWeek = function getFirstDateOfWeek(d){
                var n = new Date(d.getTime());
                n.setUTCHours(0,0,0,0);
                // Set to Monday
                n.setUTCDate(n.getUTCDate() - n.getUTCDay() + 1);
                return n;
              };
              var weekResult = google.visualization.data.group(
                dataTable,
                [{column: 0, modifier: getFirstDateOfWeek, type: 'date'}],
                [{'column': 1, 'aggregation': google.visualization.data.sum, 'type': 'number'},
                  {'column': 2, 'aggregation': google.visualization.data.sum, 'type': 'number'}]
              );
              return weekResult;
            }
            else{
              return dataTable;
            }
          }

          function draw() {
            if (!draw.triggered && ($scope.chart != undefined)) {
              draw.triggered = true;
              $timeout(function () {
                draw.triggered = false;

                if (typeof($scope.formatters) === 'undefined')
                  $scope.formatters = {};

                var dataTable;
                if ($scope.chart.data instanceof google.visualization.DataTable)
                  dataTable = $scope.chart.data;
                else if (Array.isArray($scope.chart.data))
                  dataTable = google.visualization.arrayToDataTable($scope.chart.data);
                else
                  dataTable = new google.visualization.DataTable($scope.chart.data, 0.5);

                if (typeof($scope.chart.formatters) != 'undefined') {
                  applyFormat("number", google.visualization.NumberFormat, dataTable);
                  applyFormat("arrow", google.visualization.ArrowFormat, dataTable);
                  applyFormat("date", google.visualization.DateFormat, dataTable);
                  applyFormat("bar", google.visualization.BarFormat, dataTable);
                  applyFormat("color", google.visualization.ColorFormat, dataTable);
                }


                var controlArgs = {
                  controlType: $scope.chart.control.type,
                  containerId:'rangefilter_div',
                  options: $scope.chart.control.options
                };
                if ($scope.control == null){
                  $scope.control = new google.visualization.ControlWrapper(controlArgs);
                  $scope.control = new google.visualization.ControlWrapper(controlArgs);
                  google.visualization.events.addListener($scope.control, 'statechange', function(state){
                    if (state.inProgress === false){
                      $scope.onRangeUpdate($scope.control.getState().range);
                    }
                  });
                }

                var chartWrapperArgs = {
                  chartType: $scope.chart.type,
                  view: $scope.chart.view,
                  options: $scope.chart.options,
                  containerId: 'chart_div'
                };

                if ($scope.chartWrapper == null) {
                  $scope.chartWrapper = new google.visualization.ChartWrapper(chartWrapperArgs);
                  google.visualization.events.addListener($scope.chartWrapper, 'ready', function () {
                    $scope.chart.displayed = true;
                    $scope.$apply(function (scope) {
                      scope.onReady({chartWrapper: scope.chartWrapper});
                    });
                  });
                  google.visualization.events.addListener($scope.chartWrapper, 'error', function (err) {
                    console.log("Chart not displayed due to error: " + err.message + ". Full error object follows.");
                    console.log(err);
                  });
                  google.visualization.events.addListener($scope.chartWrapper, 'select', function () {
                    var selectedItem = $scope.chartWrapper.getChart().getSelection()[0];
                    if (selectedItem) {
                      $scope.$apply(function () {
                        $scope.select({selectedItem: selectedItem});
                      });
                    }
                  });
                }
                else {
                  $scope.chartWrapper.setChartType($scope.chart.type);
                  $scope.chartWrapper.setView($scope.chart.view);
                  $scope.chartWrapper.setOptions($scope.chart.options);
                }

                if($scope.dashboard == null){
                  $scope.dashboard = new google.visualization.Dashboard($elm[0]);
                  $scope.dashboard.bind($scope.control, $scope.chartWrapper);
                }
                //category group with select
                if ($scope.categoryWrapper == null){
                  $scope.categoryWrapper = angular.element($elm[0].children[0]);
                  $scope.categoryWrapper.bind('change', function(){
                    $scope.category = this.options[this.selectedIndex].value;
                    var result = getCategoryTable($scope.category, dataTable);
                    $scope.dashboard.draw(result);
                  });
                  // no category selected, draw default table
                  $timeout(function () {
                    $scope.dashboard.draw(dataTable);
                  });
                }
                //if there is category selected, draw with that
                else{
                  $timeout(function () {
                    var result = getCategoryTable($scope.category, dataTable);
                    $scope.dashboard.draw(result);
                  });
                }
//@@TODO change select to build-in google chart function

              }, 0, true);
            }
          }

          function drawAsync() {
            googleChartApiPromise.then(function () {
              draw();
            });
          }
        }
      };
    }])

    .run(['$rootScope', '$window', function ($rootScope, $window) {
      angular.element($window).bind('resize', function () {
        $rootScope.$emit('resizeMsg');
      });
    }]);

})(document, window);
