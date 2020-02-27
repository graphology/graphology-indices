/**
 * Graphology Outbound Neighborhood Indices
 * =========================================
 */
var typed = require('mnemonist/utils/typed-arrays');

function OutboundNeighborhoodIndex(graph) {
  var upperBound = graph.directedSize + graph.undirectedSize * 2;

  var PointerArray = typed.getPointerArray(upperBound);

  // NOTE: directedSize + undirectedSize * 2 is an upper bound for
  // neighborhood size
  this.graph = graph;
  this.neighborhood = new PointerArray(upperBound);

  this.starts = new PointerArray(graph.order);
  this.stops = new PointerArray(graph.order);

  this.nodes = graph.nodes();

  var ids = {};

  var i, l, j, m, node, neighbors;

  var n = 0;

  for (i = 0, l = graph.order; i < l; i++)
    ids[this.nodes[i]] = i;

  for (i = 0, l = graph.order; i < l; i++) {
    node = this.nodes[i];
    neighbors = graph.outboundNeighbors(node);

    this.starts[i] = n;
    this.stops[i] = n + neighbors.length;

    for (j = 0, m = neighbors.length; j < m; j++)
      this.neighborhood[n++] = ids[neighbors[j]];
  }
}

OutboundNeighborhoodIndex.prototype.bounds = function(i) {
  return [this.starts[i], this.stops[i]];
};

OutboundNeighborhoodIndex.prototype.project = function() {
  var self = this;

  var projection = {};

  self.nodes.forEach(function(node, i) {
    projection[node] = Array.from(
      self.neighborhood.slice(self.starts[i], self.stops[i])
    ).map(function(j) {
      return self.nodes[j];
    });
  });

  return projection;
};

OutboundNeighborhoodIndex.prototype.collect = function(results) {
  var i, l;

  var o = {};

  for (i = 0, l = results.length; i < l; i++)
    o[this.nodes[i]] = results[i];

  return o;
};

OutboundNeighborhoodIndex.prototype.assign = function(prop, results) {
  var i, l;

  for (i = 0, l = results.length; i < l; i++)
    this.graph.setNodeAttribute(this.nodes[i], prop, results[i]);
};

exports.OutboundNeighborhoodIndex = OutboundNeighborhoodIndex;
