/**
 * Graphology Indices Unit Tests
 * ==============================
 */
var assert = require('assert');
var Graph = require('graphology');
var outbound = require('../neighborhood/outbound.js');

var OutboundNeighborhoodIndex = outbound.OutboundNeighborhoodIndex;
var WeightedOutboundNeighborhoodIndex = outbound.WeightedOutboundNeighborhoodIndex;

describe('Neighborhood Indices', function() {
  describe('OutboundNeighborhoodIndex', function() {

    it('should properly index the outbound neighborhood of the given graph.', function() {
      var graph = new Graph();
      graph.mergeEdge(1, 2);
      graph.mergeEdge(2, 3);
      graph.mergeEdge(2, 1);
      graph.mergeEdge(4, 5);

      var index = new OutboundNeighborhoodIndex(graph);
      assert.deepEqual(index.neighborhood, new Uint8Array([1, 0, 2, 4]));

      var projection = index.project();

      var neighbors = {};

      graph.forEachNode(function(node) {
        neighbors[node] = graph.outboundNeighbors(node);
      });

      assert.deepEqual(projection, neighbors);

      var results = [0.1, 0.2, 0.3, 0.4, 0.5];

      var resultIndex = {
        1: 0.1,
        2: 0.2,
        3: 0.3,
        4: 0.4,
        5: 0.5
      };

      assert.deepEqual(index.collect(results), resultIndex);

      index.assign('result', results);

      graph.forEachNode(function(node) {
        assert.strictEqual(graph.getNodeAttribute(node, 'result'), resultIndex[node]);
      });
    });
  });

  describe('WeightedOutboundNeighborhoodIndex', function() {

    it('should properly index the weighted outbound neighborhood of the given graph.', function() {
      var graph = new Graph();
      graph.mergeEdge(1, 2, {weight: 3});
      graph.mergeEdge(2, 3, {weight: 2});
      graph.mergeEdge(2, 1, {weight: 1});
      graph.mergeEdge(4, 5, {weight: 34});

      var index = new WeightedOutboundNeighborhoodIndex(graph);
      assert.deepEqual(index.neighborhood, new Uint8Array([1, 0, 2, 4]));
      assert.deepEqual(index.weights, new Float64Array([3, 1, 2, 34]));

      var projection = index.project();

      var neighbors = {};

      graph.forEachNode(function(node) {
        neighbors[node] = graph.outboundNeighbors(node);
      });

      assert.deepEqual(projection, neighbors);

      var results = [0.1, 0.2, 0.3, 0.4, 0.5];

      var resultIndex = {
        1: 0.1,
        2: 0.2,
        3: 0.3,
        4: 0.4,
        5: 0.5
      };

      assert.deepEqual(index.collect(results), resultIndex);

      index.assign('result', results);

      graph.forEachNode(function(node) {
        assert.strictEqual(graph.getNodeAttribute(node, 'result'), resultIndex[node]);
      });
    });
  });
});
