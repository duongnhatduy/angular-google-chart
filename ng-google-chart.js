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
          //chart data object, type, options, formatter
          chart: '=',
          chartControl: '=chartControl',
          onRangeUpdate: '=',
          modifier: '=',
          aggregator: '@',
          onReady: '&',
          select: '&'
        },
        template: '<div id="chart_div"></div><div style="height:50px" id="rangefilter_div"></div>',
        link: function ($scope, $elm, $attr) {
          googleChartApiPromise.then(function () {
            var zoomerState, controlWrapper, dashboard, chartWrapper, formatters, dataTable;
            var originalZoomControlState;
            originalZoomControlState = zoomerState = {range: {}};
            // Watches, to refresh the chart when its data, title or dimensions change
            // Watch for chart data from undefined to array
            $scope.$watch('chart', function (chart) {
              if(!chart){
                return;
              }
              if (chart.data instanceof google.visualization.DataTable){
                dataTable = chart.data;
              }
              else if (Array.isArray($scope.chart.data)){
                dataTable = google.visualization.arrayToDataTable(chart.data);
              }
              else{
                dataTable = new google.visualization.DataTable(chart.data, 0.5);
              }
              if (typeof(chart.formatters) != 'undefined') {
                //@@TODO: refactor applyFormat
                applyFormat("number", google.visualization.NumberFormat, dataTable);
                applyFormat("arrow", google.visualization.ArrowFormat, dataTable);
                applyFormat("date", google.visualization.DateFormat, dataTable);
                applyFormat("bar", google.visualization.BarFormat, dataTable);
                applyFormat("color", google.visualization.ColorFormat, dataTable);
              }
              draw();
            }, true);
            $scope.$watch('modifier', function () {
              try{
                draw();
              }
              catch(e){
                //error if chart is undefined
              }
            });
            formatters = {};
            var controlArgs = {
              controlType: $scope.chartControl.type,
              containerId: 'rangefilter_div',
              options: $scope.chartControl.options
            };
            controlWrapper = new google.visualization.ControlWrapper(controlArgs);
            controlWrapper.setState(controlArgs.options.state);

            google.visualization.events.addListener(controlWrapper, 'statechange', function (state) {
              if (state.inProgress === false) {
                zoomerState = controlWrapper.getState();
                $scope.onRangeUpdate(zoomerState.range);
                //                      $scope.stateChanged = true;
              }
            });
            var chartWrapperArgs = {
              chartType: $scope.chart.type,
              view: $scope.chart.view,
              options: $scope.chart.options,
              containerId: 'chart_div'
            };

            chartWrapper = new google.visualization.ChartWrapper(chartWrapperArgs);
            google.visualization.events.addListener(chartWrapper, 'ready', function () {
              $scope.chart.displayed = true;
              $scope.$apply(function (scope) {
                scope.onReady({chartWrapper: chartWrapper});
              });
            });
            google.visualization.events.addListener(chartWrapper, 'error', function (err) {
              console.log("Chart not displayed due to error: " + err.message + ". Full error object follows.");
              console.log(err);
            });
            google.visualization.events.addListener(chartWrapper, 'select', function () {
              var selectedItem = chartWrapper.getChart().getSelection()[0];
              if (selectedItem) {
                $scope.$apply(function () {
                  $scope.select({selectedItem: selectedItem});
                });
              }
            });

//            else {
//              chartWrapper.setChartType($scope.chart.type);
//              chartWrapper.setView($scope.chart.view);
//              chartWrapper.setOptions($scope.chart.options);
//            }

            dashboard = new google.visualization.Dashboard($elm[0]);
            dashboard.bind(controlWrapper, chartWrapper);


            // Redraw the chart if the window is resized
            $rootScope.$on('resizeMsg', function (e) {
              // Not always defined yet in IE so check
              if (chartWrapper) {
                draw();
              }
            });

            function applyFormat(formatType, formatClass, dataTable) {

              if (typeof($scope.chart.formatters[formatType]) != 'undefined') {
                if (formatters[formatType] == null) {
                  formatters[formatType] = new Array();

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

                      formatters[formatType].push(colorFormat)
                    }
                  } else {

                    for (var i = 0; i < $scope.chart.formatters[formatType].length; i++) {
                      formatters[formatType].push(new formatClass(
                        $scope.chart.formatters[formatType][i])
                      );
                    }
                  }
                }


                //apply formats to dataTable
                for (var i = 0; i < formatters[formatType].length; i++) {
                  if ($scope.chart.formatters[formatType][i].columnNum < dataTable.getNumberOfColumns())
                    formatters[formatType][i].format(dataTable, $scope.chart.formatters[formatType][i].columnNum);
                }


                //Many formatters require HTML tags to display special formatting
                if (formatType === 'arrow' || formatType === 'bar' || formatType === 'color')
                  $scope.chart.options.allowHtml = true;
              }
            }

            var getCategoryTable = function getCategoryTable(dataTable) {
              if ($scope.modifier) {
                var result = google.visualization.data.group(
                  dataTable,
                  [
                    {column: 0, modifier: $scope.modifier, type: 'date'}
                  ],
                  [
                    {'column': 1, 'aggregation': google.visualization.data[$scope.aggregator], 'type': 'number'},
                    {'column': 2, 'aggregation': google.visualization.data[$scope.aggregator], 'type': 'number'}
                  ]
                );
                var formatter_month = new google.visualization.DateFormat({pattern: $scope.modifier.format});
                formatter_month.format(result, 0);
                return result;
              }
              else {
                return dataTable;
              }
            }

            function draw() {
              var result = getCategoryTable(dataTable);
              try{
                var lastUnit = result.getValue(result.getNumberOfRows() - 1, 0);
                var secondLastUnit = result.getValue(result.getNumberOfRows() - 2, 0);
                var currentTimeUnit = $scope.modifier(new Date());
                if (currentTimeUnit.getTime() === lastUnit.getTime()){
                  zoomerState.range.end = secondLastUnit;
                }
              }
              catch(e){
                console.log(e, 'e');
              }
              dashboard.draw(result);
              if(zoomerState === originalZoomControlState){
                controlWrapper.setState(zoomerState);
              }

//@@TODO change select to build-in google chart function
              //@@TODO date range being exclusive

            }
          });
        }
      };
    }])

    .run(['$rootScope', '$window', function ($rootScope, $window) {
      angular.element($window).bind('resize', function () {
        $rootScope.$emit('resizeMsg');
      });
    }]);

})(document, window);
