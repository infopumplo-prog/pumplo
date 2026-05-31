import QRCodeStyling from 'qr-code-styling';

const PUMPLO_LOGO_URL = '/pumplo-icon.png';

export const generateStationQR = (shortCode: string, size = 1000): QRCodeStyling => {
  const baseUrl = window.location.origin;
  const url = `${baseUrl}/s/${shortCode}`;

  return new QRCodeStyling({
    width: size,
    height: size,
    type: 'svg',
    data: url,
    image: PUMPLO_LOGO_URL,
    dotsOptions: {
      color: '#ffffff',
      type: 'rounded',
    },
    backgroundOptions: {
      color: '#0B1222',
    },
    imageOptions: {
      crossOrigin: 'anonymous',
      margin: 10,
      imageSize: 0.35,
    },
    cornersSquareOptions: {
      color: '#4CC9FF',
      type: 'extra-rounded',
    },
    cornersDotOptions: {
      color: '#4CC9FF',
      type: 'dot',
    },
    qrOptions: {
      errorCorrectionLevel: 'H',
    },
  });
};

export const downloadQRAsPNG = async (shortCode: string, machineName: string): Promise<void> => {
  const qr = generateStationQR(shortCode, 2000);
  const blob = await qr.getRawData('png');
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pumplo-qr-${machineName.toLowerCase().replace(/\s+/g, '-')}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
