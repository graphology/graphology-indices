/**
 * Graphology Louvain Indices
 * ===========================
 */
var typed = require('mnemonist/utils/typed-arrays');

// TODO: separate directed from undirected index!

var DEFAULTS = {
  attributes: {
    weight: 'weight'
  },
  weighted: false
};

function UndirectedLouvainIndex(graph, options) {

  // Solving options
  options = options || {};
  var attributes = options.attributes || {};

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
  this.graph = graph;
  this.nodes = graph.nodes();

  // Edge-level
  this.neighborhood = new PointerArray(upperBound);
  this.weights = new Float64Array(upperBound);

  // Node-level
  this.starts = new PointerArray(graph.order);
  this.stops = new PointerArray(graph.order);
  this.belongings = new PointerArray(graph.order);

  // Community-level
  this.internalWeights = new Float64Array(graph.order);
  this.totalWeights = new Float64Array(graph.order);

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

      // Doing only once per edge
      if (node < neighbor)
        this.M += weight;

      this.totalWeights[i] += weight;

      this.neighborhood[n] = ids[neighbor];
      this.weights[n] = weight;

      // NOTE: we could handle self-loops here by incrementing `internalWeights`

      n++;
    }
  }
}

UndirectedLouvainIndex.prototype.moveNodeToCommunity = function(
  i,
  degree,
  currentCommunityDegree,
  targetCommunityDegree,
  targetCommunity
) {
  var currentCommunity = this.belongings[i];

  this.totalWeights[currentCommunity] -= currentCommunityDegree + (degree - currentCommunityDegree);
  this.totalWeights[targetCommunity] += targetCommunityDegree + (degree - targetCommunityDegree);

  this.internalWeights[currentCommunity] -= currentCommunityDegree * 2;
  this.internalWeights[targetCommunity] += targetCommunityDegree * 2;

  this.belongings[i] = targetCommunity;
};

// TODO: self loop values when zooming out? should consider self internal weight when computing degrees

UndirectedLouvainIndex.prototype.bounds = function(i) {
  return [this.starts[i], this.stops[i]];
};

UndirectedLouvainIndex.prototype.project = function() {
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

function DirectedLouvainIndex(graph, options) {

  // Solving options
  options = options || {};
  var attributes = options.attributes || {};

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
  this.graph = graph;
  this.nodes = graph.nodes();

  // Edge-level
  this.neighborhood = new PointerArray(upperBound);
  this.weights = new Float64Array(upperBound);
  this.outs = new Uint8Array(upperBound); // TODO: use bitset or alternative optimization?

  // Node-level
  this.starts = new PointerArray(graph.order);
  this.stops = new PointerArray(graph.order);
  this.belongings = new PointerArray(graph.order);

  // Community-level
  this.internalWeights = new Float64Array(graph.order);
  this.totalInWeights = new Float64Array(graph.order);
  this.totalOutWeights = new Float64Array(graph.order);

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

      // Doing this only when the edge is going out
      if (graph.source(edge) === node) {
        this.outs[n] = 1;
        this.M += weight;

        this.totalOutWeights[i] += weight;
        this.totalInWeights[ids[neighbor]] += weight;
      }

      this.neighborhood[n] = ids[neighbor];
      this.weights[n] = weight;

      // NOTE: we could handle self-loops here by incrementing `internalWeights`

      n++;
    }
  }
}

DirectedLouvainIndex.prototype.bounds = UndirectedLouvainIndex.prototype.bounds;
DirectedLouvainIndex.prototype.project = UndirectedLouvainIndex.prototype.project;

DirectedLouvainIndex.prototype.moveNodeToCommunity = function(
  i,
  inDegree,
  outDegree,
  currentCommunityInDegree,
  currentCommunityOutDegree,
  targetCommunityInDegree,
  targetCommunityOutDegree,
  targetCommunity
) {
  var currentCommunity = this.belongings[i];

  this.totalInWeights[currentCommunity] -= currentCommunityInDegree + (inDegree - currentCommunityInDegree);
  this.totalInWeights[targetCommunity] += targetCommunityInDegree + (inDegree - targetCommunityInDegree);

  this.totalOutWeights[currentCommunity] -= currentCommunityOutDegree + (outDegree - currentCommunityOutDegree);
  this.totalOutWeights[targetCommunity] += targetCommunityOutDegree + (outDegree - targetCommunityOutDegree);

  this.internalWeights[currentCommunity] -= currentCommunityInDegree + currentCommunityOutDegree;
  this.internalWeights[targetCommunity] += targetCommunityInDegree + targetCommunityOutDegree;

  this.belongings[i] = targetCommunity;
};

exports.UndirectedLouvainIndex = UndirectedLouvainIndex;
exports.DirectedLouvainIndex = DirectedLouvainIndex;
