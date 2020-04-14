/**
 * Graphology Louvain Indices
 * ===========================
 *
 * Undirected & Directed Louvain Index structures used to compute the famous
 * Louvain community detection algorithm.
 *
 * Most of the rationale is explained in `graphology-metrics`.
 *
 * Note that this index shares a lot with the classic Union-Find data
 * structure. As such, note that its structural integrity is only guaranteed
 * if the number of communities only decreases, never increases, which is the
 * case when applying Louvain's algorithm. It is possible to allow communities
 * to increase back, i.e. by isolating nodes again, but this would require
 * to store a stack of now unused community ids.
 *
 * [Articles]
 * M. E. J. Newman, « Modularity and community structure in networks »,
 * Proc. Natl. Acad. Sci. USA, vol. 103, no 23,‎ 2006, p. 8577–8582
 * https://dx.doi.org/10.1073%2Fpnas.0601602103
 *
 * Newman, M. E. J. « Community detection in networks: Modularity optimization
 * and maximum likelihood are equivalent ». Physical Review E, vol. 94, no 5,
 * novembre 2016, p. 052315. arXiv.org, doi:10.1103/PhysRevE.94.052315.
 * https://arxiv.org/pdf/1606.02319.pdf
 *
 * Blondel, Vincent D., et al. « Fast unfolding of communities in large
 * networks ». Journal of Statistical Mechanics: Theory and Experiment,
 * vol. 2008, no 10, octobre 2008, p. P10008. DOI.org (Crossref),
 * doi:10.1088/1742-5468/2008/10/P10008.
 * https://arxiv.org/pdf/0803.0476.pdf
 *
 * Nicolas Dugué, Anthony Perez. Directed Louvain: maximizing modularity in
 * directed networks. [Research Report] Université d’Orléans. 2015. hal-01231784
 * https://hal.archives-ouvertes.fr/hal-01231784
 *
 * R. Lambiotte, J.-C. Delvenne and M. Barahona. Laplacian Dynamics and
 * Multiscale Modular Structure in Networks,
 * doi:10.1109/TNSE.2015.2391998.
 * https://arxiv.org/abs/0812.1770
 *
 * [Latex]:
 *
 * Undirected Case:
 * ----------------
 *
 * \Delta Q=\bigg{[}\frac{\sum^{c}_{in}-(2d_{c}+l)}{2m}-\bigg{(}\frac{\sum^{c}_{tot}-(d+l)}{2m}\bigg{)}^{2}+\frac{\sum^{t}_{in}+(2d_{t}+l)}{2m}-\bigg{(}\frac{\sum^{t}_{tot}+(d+l)}{2m}\bigg{)}^{2}\bigg{]}-\bigg{[}\frac{\sum^{c}_{in}}{2m}-\bigg{(}\frac{\sum^{c}_{tot}}{2m}\bigg{)}^{2}+\frac{\sum^{t}_{in}}{2m}-\bigg{(}\frac{\sum^{t}_{tot}}{2m}\bigg{)}^{2}\bigg{]}
 * \Delta Q=\frac{d_{t}-d_{c}}{m}+\frac{l\sum^{c}_{tot}+d\sum^{c}_{tot}-d^{2}-l^{2}-2dl-l\sum^{t}_{tot}-d\sum^{t}_{tot}}{2m^{2}}
 * \Delta Q=\frac{d_{t}-d_{c}}{m}+\frac{(l+d)\sum^{c}_{tot}-d^{2}-l^{2}-2dl-(l+d)\sum^{t}_{tot}}{2m^{2}}
 *
 * Directed Case:
 * --------------
 * \Delta Q_d=\bigg{[}\frac{\sum^{c}_{in}-(d_{c.in}+d_{c.out}+l)}{m}-\frac{(\sum^{c}_{tot.in}-(d_{in}+l))(\sum^{c}_{tot.out}-(d_{out}+l))}{m^{2}}+\frac{\sum^{t}_{in}+(d_{t.in}+d_{t.out}+l)}{m}-\frac{(\sum^{t}_{tot.in}+(d_{in}+l))(\sum^{t}_{tot.out}+(d_{out}+l))}{m^{2}}\bigg{]}-\bigg{[}\frac{\sum^{c}_{in}}{m}-\frac{\sum^{c}_{tot.in}\sum^{c}_{tot.out}}{m^{2}}+\frac{\sum^{t}_{in}}{m}-\frac{\sum^{t}_{tot.in}\sum^{t}_{tot.out}}{m^{2}}\bigg{]}
 *
 * [Notes]:
 * Louvain is a bit unclear on this but delta computation are not derived from
 * Q1 - Q2 but rather between Q when considered node is isolated in its own
 * community versus Q with this node in target community.
 *
 * Thus, and this is where implementation differ, if you allow negative moves,
 * you will need to consider additional possibilities:
 *  - Delta of keeping node in its current community
 *  - Delta of keeping node isolated in its own community
 */
var typed = require('mnemonist/utils/typed-arrays');

var INSPECT = Symbol.for('nodejs.util.inspect.custom');

var DEFAULTS = {
  attributes: {
    weight: 'weight'
  },
  keepDendrogram: false,
  resolution: 1,
  weighted: false
};

function UndirectedLouvainIndex(graph, options) {

  // Solving options
  options = options || {};
  var attributes = options.attributes || {};

  var keepDendrogram = options.keepDendrogram === true;

  var resolution = typeof options.resolution === 'number' ?
    options.resolution :
    DEFAULTS.resolution;

  // Weight getters
  var weighted = options.weighted === true;

  var weightAttribute = attributes.weight || DEFAULTS.attributes.weight;

  var getWeight = function(attr) {
    if (!weighted)
      return 1;

    var weight = attr[weightAttribute];

    if (typeof weight !== 'number' || isNaN(weight))
      return 1;

    return weight;
  };

  // Building the index
  var upperBound = graph.size * 2;

  var NeighborhoodPointerArray = typed.getPointerArray(upperBound);
  var NodesPointerArray = typed.getPointerArray(graph.order);

  // Properties
  this.C = graph.order;
  this.M = 0;
  this.E = graph.size * 2;
  this.resolution = resolution;
  this.level = 0;
  this.graph = graph;
  this.nodes = new Array(graph.order);
  this.keepDendrogram = keepDendrogram;

  // Edge-level
  this.neighborhood = new NodesPointerArray(upperBound);
  this.weights = new Float64Array(upperBound);

  // Node-level
  this.loops = new Float64Array(graph.order);
  this.starts = new NeighborhoodPointerArray(graph.order + 1);
  this.belongings = new NodesPointerArray(graph.order);
  this.dendrogram = [];
  this.mapping = null;

  // Community-level
  this.internalWeights = new Float64Array(graph.order);
  this.totalWeights = new Float64Array(graph.order);

  var ids = {};

  var weight;

  var i = 0,
      n = 0;

  var self = this;

  // TODO: this is implementation specific
  graph._nodes.forEach(function(nodeData, node) {
    self.nodes[i] = node;

    // Node map to index
    ids[node] = i;

    // Initializing starts
    n += nodeData.undirectedDegree;
    self.starts[i] = n;

    // Belongings
    self.belongings[i] = i;
    i++;
  });

  // Single sweep over the edges
  graph.forEachEdge(function(edge, attr, source, target) {
    weight = getWeight(attr);

    source = ids[source];
    target = ids[target];

    self.M += weight;

    // Self loop?
    if (source === target) {
      self.E -= 2;
      self.totalWeights[source] += weight * 2;
      self.internalWeights[source] += weight * 2;
      self.loops[source] = weight * 2;
    }
    else {
      self.totalWeights[source] += weight;
      self.totalWeights[target] += weight;

      var startSource = --self.starts[source],
          startTarget = --self.starts[target];

      self.neighborhood[startSource] = target;
      self.neighborhood[startTarget] = source;

      self.weights[startSource] = weight;
      self.weights[startTarget] = weight;
    }
  });

  this.starts[i] = this.E;

  if (this.keepDendrogram)
    this.dendrogram.push(this.belongings.slice());
  else
    this.mapping = this.belongings.slice();
}

UndirectedLouvainIndex.prototype.move = function(
  i,
  degree,
  currentCommunityDegree,
  targetCommunityDegree,
  targetCommunity
) {
  var currentCommunity = this.belongings[i],
      loops = this.loops[i];

  this.totalWeights[currentCommunity] -= degree + loops;
  this.totalWeights[targetCommunity] += degree + loops;

  this.internalWeights[currentCommunity] -= currentCommunityDegree * 2 + loops;
  this.internalWeights[targetCommunity] += targetCommunityDegree * 2 + loops;

  this.belongings[i] = targetCommunity;
};

UndirectedLouvainIndex.prototype.expensiveMove = function(i, ci, dryRun) {
  var o, l, n, cn, weight;

  var degree = 0,
      currentCommunityDegree = 0,
      targetCommunityDegree = 0;

  var c = this.belongings[i];

  for (o = this.starts[i], l = this.starts[i + 1]; o < l; o++) {
    n = this.neighborhood[o];
    weight = this.weights[o];

    degree += weight;

    cn = this.belongings[n];

    if (cn === ci)
      targetCommunityDegree += weight;

    if (c === cn)
      currentCommunityDegree += weight;
  }

  var args = [i, degree, currentCommunityDegree, targetCommunityDegree, ci];

  if (dryRun)
    return args;

  this.move.apply(this, args);
};

UndirectedLouvainIndex.prototype.zoomOut = function() {
  var inducedGraph = {},
      newLabels = {};

  var N = this.nodes.length;

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
  var currentLevel, nextLevel;

  if (this.keepDendrogram) {
    currentLevel = this.dendrogram[this.level];
    nextLevel = new (typed.getPointerArray(C))(N);

    for (i = 0; i < N; i++)
      nextLevel[i] = this.belongings[currentLevel[i]];

    this.dendrogram.push(nextLevel);
  }
  else {
    for (i = 0; i < N; i++)
      this.mapping[i] = this.belongings[this.mapping[i]];
  }

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

      adj[cj] += this.weights[j];
    }
  }

  // Rewriting neighborhood
  this.C = C;

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

      E++;
      n++;
    }
  }

  this.starts[C] = E;

  this.E = E;
  this.level++;
};

UndirectedLouvainIndex.prototype.modularity = function() {

  var Q = 0;
  var M2 = this.M * 2;

  for (var i = 0; i < this.C; i++)
    Q += (
      this.internalWeights[i] / M2 -
      Math.pow(this.totalWeights[i] / M2, 2) * this.resolution
    );

  return Q;
};

UndirectedLouvainIndex.prototype.delta = function(i, degree, targetCommunityDegree, targetCommunity) {
  var M = this.M;

  var targetCommunityTotalWeight = this.totalWeights[targetCommunity];

  degree += this.loops[i];

  return (
    (targetCommunityDegree / M) - // NOTE: formula is a bit different here because targetCommunityDegree is passed without * 2
    (
      (targetCommunityTotalWeight * degree) /
      (2 * M * M)
    )
  );
};

UndirectedLouvainIndex.prototype.deltaWithOwnCommunity = function(i, degree, targetCommunityDegree, targetCommunity) {
  var M = this.M;

  var targetCommunityTotalWeight = this.totalWeights[targetCommunity];

  degree += this.loops[i];

  return (
    (targetCommunityDegree / M) - // NOTE: formula is a bit different here because targetCommunityDegree is passed without * 2
    (
      ((targetCommunityTotalWeight - degree) * degree) /
      (2 * M * M)
    )
  );
};

// NOTE: this function cannot work for self community move without changing
// the underlying formula. We don't have to use it thusly anyway since
// ∆Q is 0 in this case.
UndirectedLouvainIndex.prototype.trueDelta = function(i, degree, currentCommunityDegree, targetCommunityDegree, targetCommunity) {
  var M = this.M;

  var currentCommunity = this.belongings[i],
      loops = this.loops[i];

  var currentCommunityTotalWeight = this.totalWeights[currentCommunity],
      targetCommunityTotalWeight = this.totalWeights[targetCommunity];

  return (
    ((targetCommunityDegree - currentCommunityDegree) / M) +
    (
      (loops + degree) * currentCommunityTotalWeight -
      Math.pow(degree, 2) -
      Math.pow(loops, 2) -
      (2 * loops * degree) -
      (loops + degree) * targetCommunityTotalWeight
    ) / (2 * Math.pow(M, 2))
  );
};

// NOTE: this is Gephi's corrected faster delta computation
UndirectedLouvainIndex.prototype.fastDelta = function(i, degree, targetCommunityDegree, targetCommunity) {
  var M = this.M;

  var targetCommunityTotalWeight = this.totalWeights[targetCommunity];

  degree += this.loops[i];

  return (
    targetCommunityDegree -
    (degree * targetCommunityTotalWeight) / (2 * M)
  );
};

UndirectedLouvainIndex.prototype.fastDeltaWithOwnCommunity = function(i, degree, targetCommunityDegree, targetCommunity) {
  var M = this.M;

  var targetCommunityTotalWeight = this.totalWeights[targetCommunity];

  degree += this.loops[i];

  return (
    targetCommunityDegree -
    (degree * (targetCommunityTotalWeight - degree)) / (2 * M)
  );
};

UndirectedLouvainIndex.prototype.bounds = function(i) {
  return [this.starts[i], this.starts[i + 1]];
};

UndirectedLouvainIndex.prototype.project = function() {
  var self = this;

  var projection = {};

  self.nodes.slice(0, this.C).forEach(function(node, i) {
    projection[node] = Array.from(
      self.neighborhood.slice(self.starts[i], self.starts[i + 1])
    ).map(function(j) {
      return self.nodes[j];
    });
  });

  return projection;
};

UndirectedLouvainIndex.prototype.collect = function(level) {
  if (arguments.length < 1)
    level = this.level;

  var o = {};

  var mapping = this.keepDendrogram ? this.dendrogram[level] : this.mapping;

  var i, l;

  for (i = 0, l = mapping.length; i < l; i++)
    o[this.nodes[i]] = mapping[i];

  return o;
};

UndirectedLouvainIndex.prototype.assign = function(prop, level) {
  if (arguments.length < 2)
    level = this.level;

  var mapping = this.keepDendrogram ? this.dendrogram[level] : this.mapping;

  var i, l;

  for (i = 0, l = mapping.length; i < l; i++)
    this.graph.setNodeAttribute(this.nodes[i], prop, mapping[i]);
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
  proxy.resolution = this.resolution;
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

  if (this.keepDendrogram)
    proxy.dendrogram = this.dendrogram;
  else
    proxy.mapping = this.mapping;

  return proxy;
};

function DirectedLouvainIndex(graph, options) {

  // Solving options
  options = options || {};
  var attributes = options.attributes || {};

  var keepDendrogram = options.keepDendrogram === true;

  var resolution = typeof options.resolution === 'number' ?
    options.resolution :
    DEFAULTS.resolution;

  // Weight getters
  var weighted = options.weighted === true;

  var weightAttribute = attributes.weight || DEFAULTS.attributes.weight;

  var getWeight = function(attr) {
    if (!weighted)
      return 1;

    var weight = attr[weightAttribute];

    if (typeof weight !== 'number' || isNaN(weight))
      return 1;

    return weight;
  };

  // Building the index
  var upperBound = graph.size * 2;

  var NeighborhoodPointerArray = typed.getPointerArray(upperBound);
  var NodesPointerArray = typed.getPointerArray(graph.order);

  // Properties
  this.C = graph.order;
  this.M = 0;
  this.E = graph.size * 2;
  this.resolution = resolution;
  this.level = 0;
  this.graph = graph;
  this.nodes = new Array(graph.order);
  this.keepDendrogram = keepDendrogram;

  // Edge-level
  // NOTE: edges are stored out then in, in this order
  this.neighborhood = new NodesPointerArray(upperBound);
  this.weights = new Float64Array(upperBound);

  // Node-level
  this.loops = new Float64Array(graph.order);
  this.starts = new NeighborhoodPointerArray(graph.order + 1);
  this.offsets = new NeighborhoodPointerArray(graph.order);
  this.belongings = new NodesPointerArray(graph.order);
  this.dendrogram = [];

  // Community-level
  this.internalWeights = new Float64Array(graph.order);
  this.totalInWeights = new Float64Array(graph.order);
  this.totalOutWeights = new Float64Array(graph.order);

  var ids = {};

  var weight;

  var i = 0,
      n = 0;

  var self = this;

  // TODO: this is implementation specific
  graph._nodes.forEach(function(nodeData, node) {
    self.nodes[i] = node;

    // Node map to index
    ids[node] = i;

    // Initializing starts & offsets
    n += nodeData.outDegree;
    self.starts[i] = n;

    n += nodeData.inDegree;
    self.offsets[i] = n;

    // Belongings
    self.belongings[i] = i;
    i++;
  });

  // Single sweep over the edges
  graph.forEachEdge(function(edge, attr, source, target) {
    weight = getWeight(attr);

    source = ids[source];
    target = ids[target];

    self.M += weight;

    // Self loop?
    if (source === target) {
      self.E -= 2;
      self.internalWeights[source] += weight;
      self.loops[source] += weight;
      self.totalInWeights[source] += weight;
      self.totalOutWeights[source] += weight;
    }
    else {
      self.totalOutWeights[source] += weight;
      self.totalInWeights[target] += weight;

      var startSource = --self.starts[source],
          startTarget = --self.offsets[target];

      self.neighborhood[startSource] = target;
      self.neighborhood[startTarget] = source;

      self.weights[startSource] = weight;
      self.weights[startTarget] = weight;
    }
  });

  this.starts[i] = this.E;

  if (this.keepDendrogram)
    this.dendrogram.push(this.belongings.slice());
  else
    this.mapping = this.belongings.slice();
}

DirectedLouvainIndex.prototype.bounds = UndirectedLouvainIndex.prototype.bounds;

DirectedLouvainIndex.prototype.inBounds = function(i) {
  return [this.offsets[i], this.starts[i + 1]];
};

DirectedLouvainIndex.prototype.outBounds = function(i) {
  return [this.starts[i], this.offsets[i]];
};

DirectedLouvainIndex.prototype.project = UndirectedLouvainIndex.prototype.project;

DirectedLouvainIndex.prototype.projectIn = function() {
  var self = this;

  var projection = {};

  self.nodes.slice(0, this.C).forEach(function(node, i) {
    projection[node] = Array.from(
      self.neighborhood.slice(self.offsets[i], self.starts[i + 1])
    ).map(function(j) {
      return self.nodes[j];
    });
  });

  return projection;
};

DirectedLouvainIndex.prototype.projectOut = function() {
  var self = this;

  var projection = {};

  self.nodes.slice(0, this.C).forEach(function(node, i) {
    projection[node] = Array.from(
      self.neighborhood.slice(self.starts[i], self.offsets[i])
    ).map(function(j) {
      return self.nodes[j];
    });
  });

  return projection;
};

DirectedLouvainIndex.prototype.move = function(
  i,
  inDegree,
  outDegree,
  currentCommunityInDegree,
  currentCommunityOutDegree,
  targetCommunityInDegree,
  targetCommunityOutDegree,
  targetCommunity
) {
  var currentCommunity = this.belongings[i],
      loops = this.loops[i];

  this.totalInWeights[currentCommunity] -= inDegree + loops;
  this.totalInWeights[targetCommunity] += inDegree + loops;

  this.totalOutWeights[currentCommunity] -= outDegree + loops;
  this.totalOutWeights[targetCommunity] += outDegree + loops;

  this.internalWeights[currentCommunity] -= currentCommunityInDegree + currentCommunityOutDegree + loops;
  this.internalWeights[targetCommunity] += targetCommunityInDegree + targetCommunityOutDegree + loops;

  this.belongings[i] = targetCommunity;
};

DirectedLouvainIndex.prototype.expensiveMove = function(i, ci, dryRun) {
  var o, l, n, out, cn, weight;

  var inDegree = 0,
      outDegree = 0,
      currentCommunityInDegree = 0,
      currentCommunityOutDegree = 0,
      targetCommunityInDegree = 0,
      targetCommunityOutDegree = 0;

  var c = this.belongings[i],
      s = this.offsets[i];

  for (o = this.starts[i], l = this.starts[i + 1]; o < l; o++) {
    out = o < s;
    n = this.neighborhood[o];
    weight = this.weights[o];

    cn = this.belongings[n];

    if (out) {
      outDegree += weight;

      if (cn === ci)
        targetCommunityOutDegree += weight;

      if (c === cn)
        currentCommunityOutDegree += weight;
    }
    else {
      inDegree += weight;

      if (cn === ci)
        targetCommunityInDegree += weight;

      if (c === cn)
        currentCommunityInDegree += weight;
    }
  }

  var args = [
    i,
    inDegree,
    outDegree,
    currentCommunityInDegree,
    currentCommunityOutDegree,
    targetCommunityInDegree,
    targetCommunityOutDegree,
    ci
  ];

  if (dryRun)
    return args;

  this.move.apply(this, args);
};

DirectedLouvainIndex.prototype.zoomOut = function() {
  var inducedGraph = {},
      newLabels = {};

  var N = this.nodes.length;

  var C = 0,
      E = 0;

  var i, j, l, m, n, ci, cj, data, offset, out, adj, inAdj, outAdj;

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
  var currentLevel, nextLevel;

  if (this.keepDendrogram) {
    currentLevel = this.dendrogram[this.level];
    nextLevel = new (typed.getPointerArray(C))(N);

    for (i = 0; i < N; i++)
      nextLevel[i] = this.belongings[currentLevel[i]];

    this.dendrogram.push(nextLevel);
  }
  else {
    for (i = 0; i < N; i++)
      this.mapping[i] = this.belongings[this.mapping[i]];
  }

  // Building induced graph matrix
  for (i = 0, l = this.C; i < l; i++) {
    ci = this.belongings[i];
    offset = this.offsets[i];

    data = inducedGraph[ci];
    inAdj = data.inAdj;
    outAdj = data.outAdj;

    for (j = this.starts[i], m = this.starts[i + 1]; j < m; j++) {
      n = this.neighborhood[j];
      cj = this.belongings[n];
      out = j < offset;

      adj = out ? outAdj : inAdj;

      if (ci === cj)
        continue;

      if (!(cj in adj))
        adj[cj] = 0;

      adj[cj] += this.weights[j];
    }
  }

  // Rewriting neighborhood
  this.C = C;

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

    for (cj in outAdj) {
      this.neighborhood[n] = cj;
      this.weights[n] = outAdj[cj];

      E++;
      n++;
    }

    this.offsets[ci] = n;

    for (cj in inAdj) {
      this.neighborhood[n] = cj;
      this.weights[n] = inAdj[cj];

      E++;
      n++;
    }
  }

  this.starts[C] = E;

  this.E = E;
  this.level++;
};

DirectedLouvainIndex.prototype.modularity = function() {

  var Q = 0;
  var M = this.M;

  for (var i = 0; i < this.C; i++)
    Q += (
      (this.internalWeights[i] / M) -
      (this.totalInWeights[i] * this.totalOutWeights[i] / Math.pow(M, 2)) *
      this.resolution
    );

  return Q;
};

DirectedLouvainIndex.prototype.delta = function(
  i,
  inDegree,
  outDegree,
  targetCommunityDegree,
  targetCommunity
) {
  var M = this.M;

  var targetCommunityTotalInWeight = this.totalInWeights[targetCommunity],
      targetCommunityTotalOutWeight = this.totalOutWeights[targetCommunity];

  var loops = this.loops[i];

  inDegree += loops;
  outDegree += loops;

  return (
    (targetCommunityDegree / M) -
    (
      (
        (outDegree * targetCommunityTotalInWeight) +
        (inDegree * targetCommunityTotalOutWeight)
      ) /
      (M * M)
    )
  );
};

DirectedLouvainIndex.prototype.deltaWithOwnCommunity = function(
  i,
  inDegree,
  outDegree,
  targetCommunityDegree,
  targetCommunity
) {
  var M = this.M;

  var targetCommunityTotalInWeight = this.totalInWeights[targetCommunity],
      targetCommunityTotalOutWeight = this.totalOutWeights[targetCommunity];

  var loops = this.loops[i];

  inDegree += loops;
  outDegree += loops;

  return (
    (targetCommunityDegree / M) -
    (
      (
        (outDegree * (targetCommunityTotalInWeight - inDegree)) +
        (inDegree * (targetCommunityTotalOutWeight - outDegree))
      ) /
      (M * M)
    )
  );
};

DirectedLouvainIndex.prototype.collect = UndirectedLouvainIndex.prototype.collect;
DirectedLouvainIndex.prototype.assign = UndirectedLouvainIndex.prototype.assign;

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
  proxy.resolution = this.resolution;
  proxy.level = this.level;
  proxy.nodes = this.nodes;
  proxy.starts = this.starts.slice(0, proxy.C + 1);

  var eTruncated = ['neighborhood', 'weights'];
  var cTruncated = ['offsets', 'loops', 'belongings', 'internalWeights', 'totalInWeights', 'totalOutWeights'];

  var self = this;

  eTruncated.forEach(function(key) {
    proxy[key] = self[key].slice(0, proxy.E);
  });

  cTruncated.forEach(function(key) {
    proxy[key] = self[key].slice(0, proxy.C);
  });

  if (this.keepDendrogram)
    proxy.dendrogram = this.dendrogram;
  else
    proxy.mapping = this.mapping;

  return proxy;
};

exports.UndirectedLouvainIndex = UndirectedLouvainIndex;
exports.DirectedLouvainIndex = DirectedLouvainIndex;
