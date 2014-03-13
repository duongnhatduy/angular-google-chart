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
    .directive('googleChart', ['$timeout', '$window', '$rootScope', 'googleChartApiPromise', '$q', function ($timeout, $window, $rootScope, googleChartApiPromise, $q) {
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
          select: '&',
          rangeTo: '=',
          rangeFrom: '='
        },
        template: '<div id="chart_div"></div><div style="height:50px" id="rangefilter_div"></div>',
        link: function ($scope, $elm, $attr) {
          googleChartApiPromise.then(function () {
            var zoomerState, controlWrapper, dashboard, chartWrapper, dataTable;
            var originalZoomControlState;
            var chartDataDefer = $q.defer();
            chartDataDefer.isResolved = false;
            var modifierDefer = $q.defer();
            modifierDefer.isResolved = false;
            originalZoomControlState = zoomerState = {range: {}};
            // Watches, to refresh the chart when its data, title or dimensions change
            // Watch for chart data from undefined to array
            $scope.$watch('chart.data', function (data) {
              if(!data){
                return;
              }
              if(!chartDataDefer.isResolved){
                // mark chartData as available;
                chartDataDefer.isResolved = true;
                chartDataDefer.resolve();
              }
              else {
                // only draw otherwise to
                // avoid double draw on init (caused by watching modifier)
                modifierDefer.promise.then(draw);
              }
              if (data instanceof google.visualization.DataTable){
                dataTable = data;
              }
              else if (Array.isArray(data)){
                dataTable = google.visualization.arrayToDataTable(data);
              }
              else{
                dataTable = new google.visualization.DataTable(data, 0.5);
              }
            }, true);

            $scope.$watch('modifier', function (m) {
              if(!m){
                return;
              }
              if(!modifierDefer.isResolved){
                // mark modifier as available;
                modifierDefer.isResolved = true;
                modifierDefer.resolve();
              }
              if(zoomerState.range.start){
                $scope.rangeFrom = zoomerState.range.start = $scope.modifier(zoomerState.range.start);
              }
              if(zoomerState.range.end){
                $scope.rangeTo = zoomerState.range.end = $scope.modifier(zoomerState.range.end, true);
              }
              // draw only when chartData is available;
              chartDataDefer.promise.then(draw);
            });
            $scope.$watchCollection('[rangeFrom, rangeTo]', function(newRange){
              if(newRange[0] && newRange[1]){
                var from = $scope.modifier(newRange[0]);
                if($scope.rangeFrom.getTime() !== from.getTime()){
                  $scope.rangeFrom = zoomerState.range.start = from;
                  return;
                }
                var to = $scope.modifier(new Date(newRange[1]), true);
                if($scope.rangeTo.getTime() !== to.getTime()){
                  zoomerState.range.end = $scope.rangeTo = to;
                  return;
                }
                //circular to draw() function because draw call rangeUpdate and change range
                if(zoomerState === originalZoomControlState){
                  originalZoomControlState = {};
                  return;
                }
                $scope.onRangeUpdate();
                draw();
              }
            });
            // Redraw the chart if the window is resized
            $rootScope.$on('resizeMsg', function (e) {
              // Not always defined yet in IE so check
              if (chartWrapper) {
                draw();
              }
            });

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
                $scope.rangeFrom = zoomerState.range.start;// = $scope.modifier(zoomerState.range.start);
                $scope.rangeTo = zoomerState.range.end;// = $scope.modifier(zoomerState.range.end, true);
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
                var formatter = new google.visualization.DateFormat({pattern: $scope.modifier.format});
                formatter.format(result, 0);
                return result;
              }
              else {
                return dataTable;
              }
            }

            function draw() {
              var result = getCategoryTable(dataTable);
              try{

                if(zoomerState === originalZoomControlState){
                  //set end range to second last unit
                  var lastUnit = result.getValue(result.getNumberOfRows() - 1, 0);
                  var startUnit = result.getValue(0, 0);
                  var secondLastUnit = result.getValue(result.getNumberOfRows() - 2, 0);
                  var currentTimeUnit = $scope.modifier(new Date());
                  if (currentTimeUnit.getTime() === lastUnit.getTime()){
                    zoomerState.range.end = secondLastUnit;
                    zoomerState.range.start = startUnit;
                  }
                  $scope.onRangeUpdate(zoomerState.range);
                }
              }
              catch(e){
                console.log(e);
              }
              dashboard.draw(result);
              controlWrapper.setState(zoomerState);

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
