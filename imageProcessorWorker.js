class ImageProcessor {
    static createCanvas(width, height) {
        return new OffscreenCanvas(width, height);
    }

    static getImageData(canvas) {
        const ctx = canvas.getContext('2d');
        return ctx.getImageData(0, 0, canvas.width, canvas.height);
    }

    static putImageData(canvas, imageData) {
        const ctx = canvas.getContext('2d');
        ctx.putImageData(imageData, 0, 0);
    }

    static imageBitmapToCanvas(imageBitmap) {
        const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imageBitmap, 0, 0);
        return canvas;
    }

    static perspectiveTransform(srcCanvas, corners, destWidth, destHeight) {
        const srcCtx = srcCanvas.getContext('2d');
        const srcImageData = srcCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height);

        const destCanvas = this.createCanvas(destWidth, destHeight);
        const destCtx = destCanvas.getContext('2d');
        const destImageData = destCtx.createImageData(destWidth, destHeight);

        const [x0, y0, x1, y1, x2, y2, x3, y3] = corners;

        const dwMinus1 = destWidth - 1;
        const dhMinus1 = destHeight - 1;

        for (let y = 0; y < destHeight; y++) {
            for (let x = 0; x < destWidth; x++) {
                const u = (dwMinus1 === 0) ? 0 : x / dwMinus1;
                const v = (dhMinus1 === 0) ? 0 : y / dhMinus1;

                const oneMinusU = 1 - u;
                const oneMinusV = 1 - v;

                const srcX = oneMinusU * oneMinusV * x0 + u * oneMinusV * x1 + u * v * x2 + oneMinusU * v * x3;
                const srcY = oneMinusU * oneMinusV * y0 + u * oneMinusV * y1 + u * v * y2 + oneMinusU * v * y3;

                const sample = this.bilinearSample(srcImageData, srcX, srcY);

                const destIndex = (y * destWidth + x) * 4;
                destImageData.data[destIndex]     = sample.r;
                destImageData.data[destIndex + 1] = sample.g;
                destImageData.data[destIndex + 2] = sample.b;
                destImageData.data[destIndex + 3] = sample.a;
            }
        }
        destCtx.putImageData(destImageData, 0, 0);
        return destCanvas;
    }

    static bilinearSample(imageData, x, y) {
        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;

        const xClamped = Math.max(0, Math.min(x, width - 1));
        const yClamped = Math.max(0, Math.min(y, height - 1));

        const x0 = Math.floor(xClamped);
        const y0 = Math.floor(yClamped);
        const x1 = Math.min(x0 + 1, width - 1);
        const y1 = Math.min(y0 + 1, height - 1);

        const dx = xClamped - x0;
        const dy = yClamped - y0;

        const oneMinusDx = 1 - dx;
        const oneMinusDy = 1 - dy;

        const index00 = (y0 * width + x0) * 4;
        const index10 = (y0 * width + x1) * 4;
        const index01 = (y1 * width + x0) * 4;
        const index11 = (y1 * width + x1) * 4;

        const r = Math.round(
            oneMinusDx * oneMinusDy * data[index00]     + dx * oneMinusDy * data[index10]     +
            oneMinusDx * dy       * data[index01]     + dx * dy       * data[index11]
        );
        const g = Math.round(
            oneMinusDx * oneMinusDy * data[index00 + 1] + dx * oneMinusDy * data[index10 + 1] +
            oneMinusDx * dy       * data[index01 + 1] + dx * dy       * data[index11 + 1]
        );
        const b = Math.round(
            oneMinusDx * oneMinusDy * data[index00 + 2] + dx * oneMinusDy * data[index10 + 2] +
            oneMinusDx * dy       * data[index01 + 2] + dx * dy       * data[index11 + 2]
        );
        const a = Math.round(
            oneMinusDx * oneMinusDy * data[index00 + 3] + dx * oneMinusDy * data[index10 + 3] +
            oneMinusDx * dy       * data[index01 + 3] + dx * dy       * data[index11 + 3]
        );

        return { r, g, b, a };
    }

    static toGrayscale(canvas) {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
            data[i] = gray; data[i + 1] = gray; data[i + 2] = gray;
        }
        const resultCanvas = this.createCanvas(canvas.width, canvas.height);
        resultCanvas.getContext('2d').putImageData(imageData, 0, 0);
        return resultCanvas;
    }

    static bilateralFilter(canvas, d = 9, sigmaColor = 75, sigmaSpace = 75) {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const width = canvas.width;
        const height = canvas.height;

        const resultData = new Uint8ClampedArray(data.length);
        const radius = Math.floor(d / 2);

        const twoSigmaSpaceSq = 2 * sigmaSpace * sigmaSpace;
        const twoSigmaColorSq = 2 * sigmaColor * sigmaColor;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let totalWeight = 0;
                let sumR = 0, sumG = 0, sumB = 0;
                const centerIndex = (y * width + x) * 4;
                const centerR = data[centerIndex];
                const centerG = data[centerIndex + 1];
                const centerB = data[centerIndex + 2];

                for (let dy = -radius; dy <= radius; dy++) {
                    for (let dx = -radius; dx <= radius; dx++) {
                        const ny = y + dy; const nx = x + dx;
                        if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
                            const neighborIndex = (ny * width + nx) * 4;
                            const neighborR = data[neighborIndex];
                            const neighborG = data[neighborIndex + 1];
                            const neighborB = data[neighborIndex + 2];
                            const spatialDistSq = dx * dx + dy * dy;
                            const spatialWeight = Math.exp(-spatialDistSq / twoSigmaSpaceSq);
                            const colorDistSq = (centerR - neighborR) * (centerR - neighborR) +
                                                (centerG - neighborG) * (centerG - neighborG) +
                                                (centerB - neighborB) * (centerB - neighborB);
                            const colorWeight = Math.exp(-colorDistSq / twoSigmaColorSq);
                            const weight = spatialWeight * colorWeight;
                            totalWeight += weight;
                            sumR += neighborR * weight; sumG += neighborG * weight; sumB += neighborB * weight;
                        }
                    }
                }
                if (totalWeight === 0) {
                    resultData[centerIndex] = centerR; resultData[centerIndex + 1] = centerG; resultData[centerIndex + 2] = centerB;
                } else {
                    resultData[centerIndex] = sumR / totalWeight; resultData[centerIndex + 1] = sumG / totalWeight; resultData[centerIndex + 2] = sumB / totalWeight;
                }
                resultData[centerIndex + 3] = data[centerIndex + 3];
            }
        }
        const resultCanvas = this.createCanvas(width, height);
        resultCanvas.getContext('2d').putImageData(new ImageData(resultData, width, height), 0, 0);
        return resultCanvas;
    }

    static adaptiveThreshold(canvas, blockSize = 15, C = 8) {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const width = canvas.width;
        const height = canvas.height;
        const resultData = new Uint8ClampedArray(data.length);
        const radius = Math.floor(blockSize / 2);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let sum = 0; let count = 0;
                for (let dy = -radius; dy <= radius; dy++) {
                    for (let dx = -radius; dx <= radius; dx++) {
                        const ny = y + dy; const nx = x + dx;
                        if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
                            const index = (ny * width + nx) * 4;
                            const gray = Math.round(0.299 * data[index] + 0.587 * data[index+1] + 0.114 * data[index+2]);
                            sum += gray; count++;
                        }
                    }
                }
                const mean = sum / count;
                const centerIndex = (y * width + x) * 4;
                const centerGray = Math.round(0.299 * data[centerIndex] + 0.587 * data[centerIndex+1] + 0.114 * data[centerIndex+2]);
                const threshold = mean - C;
                const value = centerGray > threshold ? 255 : 0;
                resultData[centerIndex] = value; resultData[centerIndex + 1] = value; resultData[centerIndex + 2] = value;
                resultData[centerIndex + 3] = 255;
            }
        }
        const resultCanvas = this.createCanvas(width, height);
        resultCanvas.getContext('2d').putImageData(new ImageData(resultData, width, height), 0, 0);
        return resultCanvas;
    }

    static calculateMean(canvas) {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        let sum = 0; let count = 0;
        for (let i = 0; i < data.length; i += 4) {
            sum += Math.round(0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2]);
            count++;
        }
        return count > 0 ? sum / count : 0;
    }

    static invert(canvas) {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            data[i] = 255 - data[i]; data[i+1] = 255 - data[i+1]; data[i+2] = 255 - data[i+2];
        }
        const resultCanvas = this.createCanvas(canvas.width, canvas.height);
        resultCanvas.getContext('2d').putImageData(imageData, 0, 0);
        return resultCanvas;
    }
}

self.onmessage = async (event) => {
    const { task, id } = event.data;

    try {
        let resultCanvas;
        let resultImageData;

        if (task === 'perspectiveTransform') {
            const { imageBitmap, corners, destWidth, destHeight } = event.data;
            const srcCanvas = ImageProcessor.imageBitmapToCanvas(imageBitmap);
            if (typeof imageBitmap.close === 'function') imageBitmap.close();
            resultCanvas = ImageProcessor.perspectiveTransform(srcCanvas, corners, destWidth, destHeight);
            resultImageData = resultCanvas.getContext('2d').getImageData(0, 0, resultCanvas.width, resultCanvas.height);
            self.postMessage({ id, success: true, imageData: resultImageData }, [resultImageData.data.buffer]);
        } else if (task === 'enhanceBAndW') {
            const { imageBitmap } = event.data;
            let workingCanvas = ImageProcessor.imageBitmapToCanvas(imageBitmap);
            if (typeof imageBitmap.close === 'function') imageBitmap.close();

            const meanBrightness = ImageProcessor.calculateMean(workingCanvas);
            if (meanBrightness < 120) {
                workingCanvas = ImageProcessor.invert(workingCanvas);
            }
            const grayCanvas = ImageProcessor.toGrayscale(workingCanvas);
            const blurredCanvas = ImageProcessor.bilateralFilter(grayCanvas);
            const enhancedCanvas = ImageProcessor.adaptiveThreshold(blurredCanvas);

            resultImageData = enhancedCanvas.getContext('2d').getImageData(0, 0, enhancedCanvas.width, enhancedCanvas.height);
            self.postMessage({ id, success: true, imageData: resultImageData }, [resultImageData.data.buffer]);
        } else if (task === 'grayscale') {
            const { imageBitmap } = event.data;
            let canvas = ImageProcessor.imageBitmapToCanvas(imageBitmap);
            if (typeof imageBitmap.close === 'function') imageBitmap.close();
            resultCanvas = ImageProcessor.toGrayscale(canvas);
            resultImageData = resultCanvas.getContext('2d').getImageData(0, 0, resultCanvas.width, resultCanvas.height);
            self.postMessage({ id, success: true, imageData: resultImageData }, [resultImageData.data.buffer]);
        } else {
            throw new Error('Unknown task in worker: ' + task);
        }
    } catch (error) {
        console.error("Error in worker:", error);
        self.postMessage({ id, success: false, error: error.message, stack: error.stack });
    }
};
