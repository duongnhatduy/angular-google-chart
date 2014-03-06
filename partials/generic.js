angular.module("google-chart-sample").controller("GenericChartCtrl", function ($scope, $routeParams) {
  $scope.chartObject = {};

  $scope.onions = [
    {v: "Onions"},
    {v: 3}
  ];
//  var data ={
//    "cols": [
//      {
//        "id": "date",
//        "label": "Date",
//        "type": "date",
//        "p": {}
//      },
//      {
//        "id": "click",
//        "label": "Click",
//        "type": "number",
//        "p": {}
//      },
//      {
//        "id": "share",
//        "label": "Share",
//        "type": "number",
//        "p": {}
//      }],
//    "rows":[
//      {
//        "c": [{"v": new Date(1385942400000)},{"v": 98},{"v":54}]
//      },
//      {
//        "c": [{"v": new Date(1386547200000)},{"v": 171},{"v":30}]
//      },
//      {
//        "c": [{"v": new Date(1387152000000)},{"v": 57},{"v":31}]
//      },
//      {
//        "c": [{"v": new Date(1387756800000)},{"v": 57},{"v":31}]
//      },
//      {
//        "c": [{"v": new Date(1388361600000)},{"v": 57},{"v":31}]
//      },
//      {
//        "c": [{"v": new Date(1388966400000)},{"v": 57},{"v":31}]
//      }
//    ]
//  }
  var data = [
    ['Date', 'Clicks', 'Shares'],
    [new Date(1385942400000), 17, 3],
    [new Date(1386547200000), 117, 35],
    [new Date(1387152000000), 48, 73],
    [new Date(1387756800000), 25, 10],
    [new Date(1388361600000), 50, 30],
    [new Date(1388966400000), 192, 53],
    [new Date(1389571200000), 22, 13],
    [new Date(1390176000000), 57, 53],
    [new Date(1390780800000), 98, 30],
    [new Date(1391385600000), 47, 23],
    [new Date(1393804800000), 3, 1]
  ]

//}
//  ]
//  }
  $scope.chartObject.categories = ['Week', 'Month'];
  $scope.chartObject.data = data;
  $scope.chartObject.formatters = {};
  $scope.chartObject.formatters['date'] = [
    {
      columnNum: 0,
      pattern: 'MMM d, yyyy'
    }
  ];

  // $routeParams.chartType == BarChart or PieChart or ColumnChart...
  $scope.chartObject.type = $routeParams.chartType;
  $scope.chartObject.options = {
    'title': 'Click Share',
    'seriesType' : "bars",
    'series': {1: {type: "line"}},
    'chartArea': {'height': '60%', 'width': '90%'},
    'focusTarget': 'category',
    'legend': 'none'
  };
  $scope.chartObject.view =  {
    'columns': [
      {
        'calc': function(dataTable, rowIndex) {
          return dataTable.getFormattedValue(rowIndex, 0);
        },
        'type': 'string'
      }, 1, 2]
  };
  $scope.chartObject.control = {};
  $scope.chartObject.control.type = 'ChartRangeFilter';
//  var endDate = new Date(data[data.length - 1][0]);
//  var startDate = new Date(endDate);
//  startDate = new Date(startDate.setMonth(endDate.getMonth() - 1));
//
//  console.log(endDate, 'endDate');
//  console.log(startDate, 'startDate');
  $scope.chartObject.control.options = {
    // Filter by the date axis.
    'filterColumnIndex': 0,
    'ui': {
      'chartType': 'LineChart',
      'chartOptions': {
        'chartArea': {'width': '60%'},
        'hAxis': {'baselineColor': 'none'}
      },
      // Display a single series that shows the closing value of the stock.
      // Thus, this view has two columns: the date (axis) and the stock value (line series).
      'chartView': {
        'columns': [0, 2]
      },

      // 1 week in milliseconds = 24 * 60 * 60 * 1000 = 86,400,000
      'minRangeSize':  86400000
    }
    // Initial range: 2012-02-09 to 2012-03-20.
//       'state': {'range': {'start': new Date(2014, 2, 1), 'end': new Date(2014, 1, 1)}}
  };
});

