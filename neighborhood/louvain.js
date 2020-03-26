/**
 * Graphology Louvain Indices
 * ===========================
 */
var typed = require('mnemonist/utils/typed-arrays');

var INSPECT = Symbol.for('nodejs.util.inspect.custom');

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
  this.E = graph.size * 2;
  this.level = 0;
  this.graph = graph;
  this.nodes = graph.nodes();

  // Edge-level
  this.neighborhood = new PointerArray(upperBound);
  this.weights = new Float64Array(upperBound);

  // Node-level
  this.loops = new Float64Array(graph.order);
  this.starts = new PointerArray(graph.order + 1);
  this.belongings = new PointerArray(graph.order);
  this.dendrogram = [];

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
      // and using #.loops

      n++;
    }
  }

  this.starts[i] = upperBound;
}

UndirectedLouvainIndex.prototype.moveNodeToCommunity = function(
  i,
  degree,
  currentCommunityDegree,
  targetCommunityDegree,
  targetCommunity
) {
  var currentCommunity = this.belongings[i],
      loops = this.loops[i];

  this.totalWeights[currentCommunity] -= currentCommunityDegree + (degree - currentCommunityDegree) + loops;
  this.totalWeights[targetCommunity] += targetCommunityDegree + (degree - targetCommunityDegree) + loops;

  this.internalWeights[currentCommunity] -= currentCommunityDegree * 2 + loops;
  this.internalWeights[targetCommunity] += targetCommunityDegree * 2 + loops;

  this.belongings[i] = targetCommunity;
};

UndirectedLouvainIndex.prototype.zoomOut = function() {
  var inducedGraph = {},
      newLabels = {};

  var C = 0,
      E = 0;

  var i, j, l, m, n, ci, cj, data, adj;

  // Renumbering communities
  for (i = 0, l = this.C; i < l; i++) {
    ci = this.belongings[i];

    if (!(ci in newLabels)) {
      newLabels[ci] = C;
      inducedGraph[C] = {
        adj: {},
        totalWeights: this.totalWeights[ci],
        internalWeights: this.internalWeights[ci]
      };
      C++;
    }

    // We do this to otpimize the number of lookups in next loop
    this.belongings[i] = newLabels[ci];
  }

  // Actualizing dendrogram
  this.dendrogram.push(this.belongings.slice(0, this.C));

  // Building induced graph matrix
  for (i = 0, l = this.C; i < l; i++) {
    ci = this.belongings[i];

    adj = inducedGraph[ci].adj;

    for (j = this.starts[i], m = this.starts[i + 1]; j < m; j++) {
      n = this.neighborhood[j];
      cj = this.belongings[n];

      if (ci === cj)
        continue;

      if (!(cj in adj))
        adj[cj] = 0;

      adj[cj] += this.weights[n];
      E++;
    }
  }

  // Rewriting neighborhood
  this.C = C;
  this.E = E;

  n = 0;

  for (ci in inducedGraph) {
    data = inducedGraph[ci];
    adj = data.adj;

    ci = +ci;

    this.totalWeights[ci] = data.totalWeights;
    this.internalWeights[ci] = data.internalWeights;
    this.loops[ci] = data.internalWeights;

    this.starts[ci] = n;
    this.belongings[ci] = ci;

    for (cj in adj) {
      this.neighborhood[n] = cj;
      this.weights[n] = adj[cj];

      n++;
    }
  }

  this.starts[C] = E;

  this.level++;
};

UndirectedLouvainIndex.prototype.bounds = function(i) {
  return [this.starts[i], this.starts[i + 1]];
};

UndirectedLouvainIndex.prototype.project = function() {
  var self = this;

  var projection = {};

  self.nodes.forEach(function(node, i) {
    projection[node] = Array.from(
      self.neighborhood.slice(self.starts[i], self.starts[i + 1])
    ).map(function(j) {
      return self.nodes[j];
    });
  });

  return projection;
};

UndirectedLouvainIndex.prototype[INSPECT] = function() {
  var proxy = {};

  // Trick so that node displays the name of the constructor
  Object.defineProperty(proxy, 'constructor', {
    value: UndirectedLouvainIndex,
    enumerable: false
  });

  proxy.C = this.C;
  proxy.M = this.M;
  proxy.E = this.E;
  proxy.level = this.level;
  proxy.nodes = this.nodes;
  proxy.starts = this.starts.slice(0, proxy.C + 1);

  var eTruncated = ['neighborhood', 'weights'];
  var cTruncated = ['loops', 'belongings', 'internalWeights', 'totalWeights'];

  var self = this;

  eTruncated.forEach(function(key) {
    proxy[key] = self[key].slice(0, proxy.E);
  });

  cTruncated.forEach(function(key) {
    proxy[key] = self[key].slice(0, proxy.C);
  });

  proxy.dendrogram = this.dendrogram;

  return proxy;
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
  this.E = graph.size;
  this.level = 0;
  this.graph = graph;
  this.nodes = graph.nodes();

  // Edge-level
  this.neighborhood = new PointerArray(upperBound);
  this.weights = new Float64Array(upperBound);
  this.outs = new Uint8Array(upperBound); // TODO: use bitset or alternative optimization?

  // Node-level
  this.loops = new PointerArray(graph.order);
  this.starts = new PointerArray(graph.order + 1);
  this.belongings = new PointerArray(graph.order);
  this.dendrogram = [];

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
      // and using #.loops

      n++;
    }
  }

  this.starts[i] = upperBound;
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

DirectedLouvainIndex.prototype.zoomOut = function() {
  var inducedGraph = {},
      newLabels = {};

  var C = 0,
      E = 0;

  var i, j, l, m, n, ci, cj, data, out, adj, inAdj, outAdj;

  // Renumbering communities
  for (i = 0, l = this.C; i < l; i++) {
    ci = this.belongings[i];

    if (!(ci in newLabels)) {
      newLabels[ci] = C;
      inducedGraph[C] = {
        inAdj: {},
        outAdj: {},
        totalInWeights: this.totalInWeights[ci],
        totalOutWeights: this.totalOutWeights[ci],
        internalWeights: this.internalWeights[ci]
      };
      C++;
    }

    // We do this to otpimize the number of lookups in next loop
    this.belongings[i] = newLabels[ci];
  }

  // Actualizing dendrogram
  this.dendrogram.push(this.belongings.slice(0, this.C));

  // Building induced graph matrix
  for (i = 0, l = this.C; i < l; i++) {
    ci = this.belongings[i];

    data = inducedGraph[ci];
    inAdj = data.inAdj;
    outAdj = data.outAdj;

    for (j = this.starts[i], m = this.starts[i + 1]; j < m; j++) {
      n = this.neighborhood[j];
      cj = this.belongings[n];
      out = this.outs[n];

      adj = out === 0 ? inAdj : outAdj;

      if (ci === cj)
        continue;

      if (!(cj in adj))
        adj[cj] = 0;

      adj[cj] += this.weights[n];
      E++;
    }
  }

  // Rewriting neighborhood
  this.C = C;
  this.E = E;

  n = 0;

  for (ci in inducedGraph) {
    data = inducedGraph[ci];
    inAdj = data.inAdj;
    outAdj = data.outAdj;

    ci = +ci;

    this.totalInWeights[ci] = data.totalInWeights;
    this.totalOutWeights[ci] = data.totalOutWeights;
    this.internalWeights[ci] = data.internalWeights;
    this.loops[ci] = data.internalWeights;

    this.starts[ci] = n;
    this.belongings[ci] = ci;

    for (cj in inAdj) {
      this.neighborhood[n] = cj;
      this.weights[n] = inAdj[cj];
      this.outs[n] = 0;

      n++;
    }

    for (cj in outAdj) {
      this.neighborhood[n] = cj;
      this.weights[n] = outAdj[cj];
      this.outs[n] = 1;

      n++;
    }
  }

  this.starts[C] = E;

  this.level++;
};

DirectedLouvainIndex.prototype[INSPECT] = function() {
  var proxy = {};

  // Trick so that node displays the name of the constructor
  Object.defineProperty(proxy, 'constructor', {
    value: DirectedLouvainIndex,
    enumerable: false
  });

  proxy.C = this.C;
  proxy.M = this.M;
  proxy.E = this.E;
  proxy.level = this.level;
  proxy.nodes = this.nodes;
  proxy.starts = this.starts.slice(0, proxy.C + 1);

  var eTruncated = ['neighborhood', 'weights', 'outs'];
  var cTruncated = ['loops', 'belongings', 'internalWeights', 'totalInWeights', 'totalOutWeights'];

  var self = this;

  eTruncated.forEach(function(key) {
    proxy[key] = self[key].slice(0, proxy.E);
  });

  cTruncated.forEach(function(key) {
    proxy[key] = self[key].slice(0, proxy.C);
  });

  proxy.dendrogram = this.dendrogram;

  return proxy;
};

exports.UndirectedLouvainIndex = UndirectedLouvainIndex;
exports.DirectedLouvainIndex = DirectedLouvainIndex;
