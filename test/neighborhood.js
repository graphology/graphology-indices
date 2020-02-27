/**
 * Graphology Indices Unit Tests
 * ==============================
 */
var assert = require('assert');
var Graph = require('graphology');
var outbound = require('../neighborhood/outbound.js');

var OutboundNeighborhoodIndex = outbound.OutboundNeighborhoodIndex;

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
});
