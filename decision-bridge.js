(function(root){
  'use strict';
  // Deliberately disconnected extension point. No endpoint, SDK, key or network
  // call is present. A future provider may propose intents, never mutate state.
  const DecisionBridge = Object.freeze({
    enabled:false,
    describe(){return {enabled:false,provider:null,mode:'local',capabilities:['career','household','relationships']};},
    request(context){return {status:'disabled',requestType:context.kind,proposal:null};},
    validateProposal(proposal,allowedActions){
      return Boolean(proposal && typeof proposal.action==='string' && allowedActions.includes(proposal.action));
    }
  });
  if(typeof module!=='undefined'&&module.exports)module.exports=DecisionBridge;else root.DanzigDecisionBridge=DecisionBridge;
})(typeof window!=='undefined'?window:globalThis);
