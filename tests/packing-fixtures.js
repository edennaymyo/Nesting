export const rectangle = { name: 'Rectangle', w: 16, h: 14, contour: { d: 'M0 0L12 0L12 8L0 8Z', box: [0,0,12,8], mmBox: [2,3,12,8] } };
export const circle = { name: 'Circle with bleed', w: 22, h: 22, contour: { d: 'M16 8C16 12.4183 12.4183 16 8 16C3.5817 16 0 12.4183 0 8C0 3.5817 3.5817 0 8 0C12.4183 0 16 3.5817 16 8Z', box: [0,0,16,16], mmBox: [3,3,16,16] } };
export const concave = { name: 'Concave L', w: 22, h: 26, contour: { d: 'M0 0L16 0L16 6L6 6L6 20L0 20Z', box: [0,0,16,20], mmBox: [2,3,16,20] } };
export const asymmetric = { name: 'Asymmetric tag', w: 23, h: 29, contour: { d: 'M0 4L6 0L15 2L17 20L7 17L0 22Z', box: [0,0,17,22], mmBox: [1.5,4,17,22] } };
export const packingFixtures = [circle, concave, asymmetric];
