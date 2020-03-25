/**
 * Graphology Louvain Indices
 * ===========================
 */
var inferType = require('graphology-utils/infer-type');
var typed = require('mnemonist/utils/typed-arrays');

// NOTE: we could probably get rid of the bit set later
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

  // Properties
  this.C = graph.order;
  this.M = 0;
  this.type = type;
  this.graph = graph;
  this.nodes = graph.nodes();

  // Edge-level
  this.neighborhood = new PointerArray(upperBound);
  this.weights = new Float64Array(upperBound);
  this.outs = new BitSet(graph.directedSize * 2);

  // Node-level
  this.starts = new PointerArray(graph.order);
  this.stops = new PointerArray(graph.order);
  this.belongings = new PointerArray(graph.order);

  // Community-level
  this.internalWeights = new PointerArray(graph.order);
  this.totalWeights = new PointerArray(type === 'undirected' ? graph.order : 0);
  this.totalInWeights = new PointerArray(type === 'directed' ? graph.order : 0);
  this.totalOutWeights = new PointerArray(type === 'directed' ? graph.order : 0);

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
    this.belongings[i] = i;

    for (j = 0, m = edges.length; j < m; j++) {
      edge = edges[j];
      neighbor = graph.opposite(node, edge);
      weight = getWeight(edge);

      if (type === 'directed') {

        // Doing this only when the edge is going out
        if (graph.source(edge) === node) {
          this.outs.set(n);
          this.M += weight;

          this.totalOutWeights[i] += weight;
          this.totalInWeights[ids[neighbor]] += weight;
        }
      }
      else {

        // Doing only once per edge
        if (node < neighbor)
          this.M += weight;

        this.totalWeights[i] += weight;
      }

      this.neighborhood[n] = ids[neighbor];
      this.weights[n] = weight;

      // NOTE: we could handle self-loops here by incrementing `internalWeights`

      n++;
    }
  }
}

LouvainIndex.prototype.moveNodeToCommunityUndirected = function(i, degree, currentCommunityDegree, targetCommunityDegree, targetCommunity) {
  var currentCommunity = this.belongings[i];

  this.totalWeights[currentCommunity] -= currentCommunityDegree;
  this.totalWeights[targetCommunity] += targetCommunityDegree;

  this.internalWeights[currentCommunity] -= currentCommunityDegree * 2;
  this.internalWeights[targetCommunity] += targetCommunityDegree * 2;

  this.belongings[i] = targetCommunity;
};

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
