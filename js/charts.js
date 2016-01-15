var _data = [];
var _demographics = [];
var original_data
var _council_bounds = {};
var _region_bounds = {};
var _auth_dict = {};
var _region_dict = {};
var _title_text = {};
var small_chart_height = 280;

var valueAccessor =function(d){return d.value < 1 ? 0 : d.value}

var getkeys;
//---------------------CLEANUP functions-------------------------

function cleanup(d) {
  d.sex_age = d.Sex+', '+d['Age group']
  d.Value = +d.Value
  return d 
}

//---------------------------crossfilter reduce functions---------------------------

// we only use the built in reduceSum(<what we are summing>) here

//----------------------------Accessor functions-------------------------------------

// because we are only using default reduce functions, we don't need any accessor functions either 

//-------------------------Load data and dictionaries ------------------------------

//Here queue makes sure we have all the data from all the sources loaded before we try and do anything with it. It also means we don't need to nest D3 file reading loops, which could be annoying. 

queue()
    .defer(d3.csv,  "data/highest qual by age and sex.csv")
    .defer(d3.csv,  "data/2013 basic demographics.csv")
    .defer(d3.csv,  "dictionaries/Region_dict.csv")
    .defer(d3.csv,  "dictionaries/titles.csv")
    .defer(d3.json, "gis/region_boundaries_singlepart_simp_p001.geojson")
    .await(showCharts);

function showCharts(err, data, demographics, region_dict, title_text, region_bounds) {


  
  
  
//We use dictionary .csv's to store things we might want to map our data to, such as codes to names, names to abbreviations etc.
  
//titles.csv is a special case of this, allowing for the mapping of text for legends and titles on to the same HTML anchors as the charts. This allows clients to update their own legends and titles by editing the csv rather than monkeying around in the .html or paying us to monkey around with the same.    
  
  var councilNames = [];
  
  for (i in title_text){
        entry = title_text[i]
        //trimAll(entry)
        name = entry.id
        _title_text[name]=entry;     
  }

    for (i in region_dict) {
    entry = region_dict[i]
    trimAll(entry)
    name = entry.Map_region
    _region_dict[name]=entry;
  }
  
  for (i in data) {
    cleanup(data[i]);
  }
  
  
 for (i in demographics) {
    if (demographics[i].Area.indexOf('Region')!= -1){
      age = demographics[i].Age.split(' ')[0].split('-')[0]
      if (age > 14){
        cleanup(demographics[i]);
        _demographics.push(demographics[i])
      }
    }
  } 

  
//  var mapped_demographics = _.map(_demographics,function(d){return {key:d.Area,value:d.Value}})
//  
//  var reduced_demographics = _.reduce(mapped_demographics, function(current,d) {
//    current[d.key] = current[d.key] || 0 + d.value;
//  }, {})
//  
  
  
  
  
region_pop = _(_demographics).reduce(function(mem, d) {
  mem[d.Area] = (mem[d.Area] || 0) + d.Value
  return mem
}, {})

  
  _data = data;
  
  
 
  _region_bounds = region_bounds;    

//------------Puts legends and titles on the chart divs and the entire page---------------   
  apply_text(_title_text)

//---------------------------------FILTERS-----------------------------------------
  ndx = crossfilter(_data); // YAY CROSSFILTER! Unless things get really complicated, this is the only bit where we call crossfilter directly. 


  
//---------------------------ORDINARY CHARTS --------------------------------------
  age = ndx.dimension(function(d) {return d.sex_age});
  age_group = age.group().reduceSum(function(d){return d.Value})
  
  age_chart = dc.pyramidChart('#tree')
    .dimension(age)
    .group(age_group)
    .valueAccessor(valueAccessor)
    .colors(d3.scale.ordinal().range([our_colors[1],our_colors[3]]))
    .colorAccessor(function(d){return d.key[0]})
    .leftColumn(function(d){return d.key[0] == 'M'}) // return true if entry is to go in the left column. Defaults to i%2 == 0, i.e. every second one goes to the right.
    .rowAccessor(function(d){return +d.key.split(' ')[1].split('-')[0]}) //return the row the group needs to go into.      
    .height(small_chart_height)
//    //.title(function(d,i){return i})
    .label(function(d){return d.key.split(' ')[1].replace('65', '65 and Over' )})
    .elasticX(true)
    .labelOffsetX(20)
    .twoLabels(false)// defaults to true. if false, .label defaults to .rowAccessor
    .columnLabels(['Male','Female'])
    .columnLabelPosition([50,225]) //[in,down], in pix. defaults to [5,10]
    .transitionDuration(200)
  
  //age_chart.xAxis().ticks(7)
  
  age_chart.xAxis().ticks(4).tickFormat(function(x){ return integer_format(Math.abs(x))});
  
  age_chart.on('pretransition.dim', dim_zero_rows) 
  
  
  qual_order = ["Doctorate degree",
                "Masters degree", 
                "Post-graduate and honours degrees",
                "Bachelor degree and level 7 qualification",
                "Level 5 or level 6 diploma",   
                "Level 4 certificate",
                "Level 3 certificate", 
                "Level 2 certificate", 
                "Level 1 certificate",
                "Overseas secondary school qualification",
                "No qualification",
                "Not elsewhere included"]
  
  qual = ndx.dimension(function(d) {return d["Highest qualification"]});
  qual_group = qual.group().reduceSum(function(d){return d.Value});
  
  qual_chart = dc.rowChart('#qual')
    .dimension(qual)
    .group(qual_group)
    //.valueAccessor(valueAccessor)
    .transitionDuration(200)
    .height(small_chart_height)
    .colors(default_colors)
    .elasticX(true)
    .ordering(function(d) {return qual_order.indexOf(d.key)})
    .title(function(d){return d.key+': '+title_integer_format(d.value)})
    

  qual_chart.xAxis().ticks(4).tickFormat(integer_format);
  qual_chart.on('pretransition.dim', dim_zero_rows) 
  
  
////----------------------------Map functions----------------------------------

  function zoomed() {
    projection
    .translate(d3.event.translate)
    .scale(d3.event.scale);
    var hidden = projection.scale() == 1600 && JSON.stringify(projection.translate()) == JSON.stringify([220,320]);
    d3.select('#resetPosition').classed('hidden',function(){return hidden})
    region_map.render();
    }
  
  zoom = d3.behavior.zoom()
    .translate(projection.translate())
    .scale(projection.scale())
    .scaleExtent([1600, 20000])
    .on("zoom", zoomed);

  
////------------------Map Regions
  
  region = ndx.dimension(function(d) { return d['Area']});
  region_group = region.group().reduceSum(function(d){return d.Value})
    
  d3.select("#region_map").call(zoom);

  function colourRenderlet(chart) {
    ext = d3.extent(region_map.data(), region_map.valueAccessor());
    ext[0]=0.0001;
    region_map.colorDomain(ext);
  }

  map_width = d3.select("#region_map").select('legend').node().getBoundingClientRect().width

  valueAccessor2 = function(d){
    proportion = d.value/region_pop[d.key]
    return proportion
  }

  region_map = dc.geoChoroplethChart("#region_map")
      .dimension(region)
      .group(region_group)
      .valueAccessor(valueAccessor2)
      .projection(projection)
      .colorAccessor(function(d){return d + 1})
      .colorCalculator(function(d){return !d ? map_zero_colour : colourscale(d)})
      .transitionDuration(200)
      .height(600)
      .width(map_width-10)
      .overlayGeoJson(_region_bounds.features, 'Region', function(d) {return d.properties.REGC2013_N})
      .colors(colourscale)
      .title(function(d) {return !d.value ? d.key + ": 0" : d.key + ": " + percent_format(d.value)})
      .on("preRender.color", colourRenderlet)
      .on("preRedraw.color", colourRenderlet)
   
  dc.renderAll()
 
}
