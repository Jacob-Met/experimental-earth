// Finite proposal policy only. A sign bracket is not a monotonicity certificate.
export function boundedCenterProposals(evaluate,residual,low,high,iterations=44){
 let a=evaluate(low),b=evaluate(high),fa=residual(a),fb=residual(b),status='no-center-bracket';
 if(fa===0||fb===0)return'endpoint-center';
 if(Math.sign(fa)!==Math.sign(fb)){status='iteration-limit';for(let i=0;i<iterations;i++){const mid=low+(high-low)/2;if(mid===low||mid===high)return'floating-point-stopped';const c=evaluate(mid),fc=residual(c);if(fc===0)return'exact-center';if(Math.sign(fc)===Math.sign(fa)){low=mid;fa=fc;}else{high=mid;fb=fc;}}}
 return status;
}
