/**
 * Graphology Louvain Indices
 * ===========================
 */
var inferType = require('graphology-utils/infer-type');
var typed = require('mnemonist/utils/typed-arrays');
var BitSet = require('mnemonist/bit-set');

var DEFAULTS = {
  attributes: {
    weight: 'weight'
  },
  weighted: false
};

function LouvainIndex(graph, options) {

  // Solving options
  options = options || {};
  var attributes = options.attributes || {};

  var type = inferType(graph);

  // Weight getters
  var weighted = options.weighted === true;

  var weightAttribute = attributes.weight || DEFAULTS.attributes.weight;

  var getWeight = function(edge) {
    if (!weighted)
      return 1;

    var weight = graph.getEdgeAttribute(edge, weightAttribute);

    if (typeof weight !== 'number' || isNaN(weight))
      return 1;

    return weight;
  };

  // Building the index
  var upperBound = graph.size * 2;

  var PointerArray = typed.getPointerArray(upperBound);

  this.M = 0;
  this.graph = graph;
  this.neighborhood = new PointerArray(upperBound);
  this.weights = new Float64Array(upperBound);
  this.outs = new BitSet(graph.directedSize * 2);

  this.starts = new PointerArray(graph.order);
  this.stops = new PointerArray(graph.order);

  this.nodes = graph.nodes();

  var ids = {};

  var i, l, j, m, node, neighbor, edges, edge, weight;

  var n = 0;

  for (i = 0, l = graph.order; i < l; i++)
    ids[this.nodes[i]] = i;

  for (i = 0, l = graph.order; i < l; i++) {
    node = this.nodes[i];
    edges = graph.edges(node);

    this.starts[i] = n;
    this.stops[i] = n + edges.length;

    for (j = 0, m = edges.length; j < m; j++) {
      edge = edges[j];
      neighbor = graph.opposite(node, edge);
      weight = getWeight(edge);

      if (type === 'directed') {

        // Doing this only when the edge is going out
        if (graph.source(edge) === node) {
          this.outs.set(n);
          this.M += weight;
        }
      }
      else {

        // Doing only once per edge
        if (node < neighbor)
          this.M += weight;
      }

      // NOTE: for weighted mixed beware of merging weights if twice the same neighbor
      this.neighborhood[n] = ids[neighbor];
      this.weights[n] = weight;

      n++;
    }
  }
}

LouvainIndex.prototype.bounds = function(i) {
  return [this.starts[i], this.stops[i]];
};

LouvainIndex.prototype.project = function() {
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

module.exports = LouvainIndex;
