function contains(outer, inner, tolerance = 0.5) {
  const [ox, oy, ow, oh] = outer, [ix, iy, iw, ih] = inner;
  return ix >= ox-tolerance && iy >= oy-tolerance && ix+iw <= ox+ow+tolerance && iy+ih <= oy+oh+tolerance;
}

function overlap(a0, a1, b0, b1) {
  return Math.max(0, Math.min(a1, b1)-Math.max(a0, b0));
}

// Illustrator EPS normally flattens every artboard into one PostScript canvas.
// When equally-sized, disjoint Cut Line shells survive that flattening, infer
// their artboard cells without pretending that arbitrary loose paths are pages.
export function detectEpsArtboards(candidates, page) {
  const paths = candidates.filter(candidate => candidate.box && candidate.box[2] > 0 && candidate.box[3] > 0);
  const shells = paths.filter((candidate, index) => !paths.some((other, otherIndex) => {
    if (index === otherIndex) return false;
    const a = candidate.box[2]*candidate.box[3], b = other.box[2]*other.box[3];
    return b > a*1.01 && contains(other.box, candidate.box);
  }));
  if (shells.length < 2 || shells.length > 24) return [];
  const widths = shells.map(item => item.box[2]), heights = shells.map(item => item.box[3]);
  if (Math.min(...widths)/Math.max(...widths) < .8 || Math.min(...heights)/Math.max(...heights) < .8) return [];
  for (let i=0;i<shells.length;i++) for (let j=i+1;j<shells.length;j++) {
    const a=shells[i].box,b=shells[j].box;
    if (overlap(a[0],a[0]+a[2],b[0],b[0]+b[2]) > .5 && overlap(a[1],a[1]+a[3],b[1],b[1]+b[3]) > .5) return [];
  }
  const ordered=[...shells].sort((a,b)=>a.box[1]-b.box[1]||a.box[0]-b.box[0]);
  return ordered.map((shell,index) => {
    const members=paths.filter(candidate=>contains(shell.box,candidate.box)), points=members.flatMap(item=>item.points), d=members.map(item=>item.d).join(' ');
    const [x,y,w,h]=shell.box,centerX=x+w/2,centerY=y+h/2;
    let left=0,right=page[0],top=0,bottom=page[1];
    for(const other of shells){
      if(other===shell)continue;
      const [nx,ny,nw,nh]=other.box,otherX=nx+nw/2,otherY=ny+nh/2;
      const verticalOverlap=overlap(y,y+h,ny,ny+nh)/Math.min(h,nh),horizontalOverlap=overlap(x,x+w,nx,nx+nw)/Math.min(w,nw);
      if(verticalOverlap>.5){if(otherX<centerX)left=Math.max(left,(nx+nw+x)/2);else right=Math.min(right,(x+w+nx)/2)}
      if(horizontalOverlap>.5){if(otherY<centerY)top=Math.max(top,(ny+nh+y)/2);else bottom=Math.min(bottom,(y+h+ny)/2)}
    }
    return{number:index+1,d,points,box:[x,y,w,h],crop:[left,page[1]-bottom,right,page[1]-top]};
  });
}
