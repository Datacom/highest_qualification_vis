function generateSplitRowChart(dim, group, anchor1, anchor2, reset_id, isInFirstChart, valueAccessor,ordering) {
  //var default_colors
 
  
  valueAccessor = valueAccessor ? valueAccessor:function(d){return d.value}
  ordering = ordering ? ordering:function(d){return d.key}
  
  function isInSecondChart(d){return !isInFirstChart(d)}
  
  function isInFirstChartKey(d){return isInFirstChart(d.key)}
  
  function isInSecondChartKey(d){return !isInFirstChartKey(d)}
  
  var chart1 = dc.rowChart(anchor1);
  
  function changeValueAccessor(new_valueAccessor) {
    valueAccessor = new_valueAccessor;
    chart1.valueAccessor(new_valueAccessor);
    chart2.valueAccessor(new_valueAccessor);
  }
  
  chart1.data(function(group){
      var data = group.all()
      var extents = d3.extent(data,function(d){return valueAccessor(d)})
      extents[0] = 0;
      chart1.x(d3.scale.linear().domain(extents).range([0, chart1.effectiveWidth()]));
      return _.sortBy(_.filter(data, isInFirstChartKey),ordering);
    })
    .dimension(dim)
    .group(group)
    .valueAccessor(function(d){return valueAccessor(d)})
    .transitionDuration(200)
    .height(600)
    .colors(default_colors)
  
  chart1.xAxis().ticks(4).tickFormat(integer_format);

  var chart2 = dc.rowChart(anchor2);
    chart2.data(function(group){
      data = group.all()
      extents = d3.extent(data,function(d){return valueAccessor(d)})
      extents[0] = 0;
      chart2.x(d3.scale.linear().domain(extents).range([0, chart2.effectiveWidth()]));
      return _.sortBy(_.filter(data, isInSecondChartKey),ordering);
    })
    .dimension(dim)
    .group(group)
    .valueAccessor(function(d){return valueAccessor(d)})
    .transitionDuration(200)
    .height(600)
    .colors(default_colors)
    
  chart2.xAxis().ticks(4).tickFormat(integer_format);

  return {"chart1":chart1, "chart2":chart2, "changeValueAccessor":changeValueAccessor};
}


function mergeFilters(charts, reset_id) {
  var dim = charts[0].dimension();
  function filter_paired_charts(chart) {
    for (i in charts) {
      charts[i].on('filtered.filter_paired_charts', undefined) // stop listeners;
    }
    
    //stick all the filters on all the charts here.... 
    filters = chart.filters();
    
    for (i in charts) {
      charts[i].filterAll();
    }
    
    for (i in filters) {
      for (j in charts) {
        charts[j].filter(filters[i]);
      }
    }
    
    hasFilters = filters.length != 0
    d3.selectAll(reset_id).classed("hidden", !hasFilters);
    
    dim.filter(function(d) { return !hasFilters || _.contains(filters, d)});
    dc.redrawAll();
    for (i in charts) {
      charts[i].on('filtered.filter_paired_charts', filter_paired_charts) // stop listeners;
    }
  }
  
  d3.selectAll(reset_id).classed("hidden", true).on('click', reset);
  
  function reset() {
    for (i in charts) {
      charts[i].filterAll();
    }
    dc.redrawAll();
  }
  
  for (i in charts) {
    charts[i].on('filtered.filter_paired_charts', filter_paired_charts);
  }
  
  return {reset:reset};
}