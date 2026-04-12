export const colors = {
    onTertiary: '#68000a',
    onSecondaryFixedVariant: '#00522c',
    onTertiaryFixedVariant: '#930013',
    inversePrimary: '#00629d',
    outlineVariant: '#404751',
    secondaryContainer: '#2ca464',
    onPrimaryFixed: '#001d34',
    secondary: '#6bdc96',
    onPrimaryContainer: '#002f4e',
    primaryFixed: '#cfe5ff',
    tertiary: '#ffb3ad',
    primaryFixedDim: '#99cbff',
    tertiaryFixedDim: '#ffb3ad',
    background: '#0b1326',
    surfaceContainerHighest: '#2d3449',
    surfaceContainer: '#171f33',
    primaryContainer: '#4299e1',
    outline: '#8a919c',
    tertiaryContainer: '#ff5b56',
    tertiaryFixed: '#ffdad7',
    inverseSurface: '#dae2fd',
    secondaryFixed: '#88f9b0',
    inverseOnSurface: '#283044',
    onSecondaryContainer: '#003118',
    errorContainer: '#93000a',
    surfaceDim: '#0b1326',
    secondaryFixedDim: '#6bdc96',
    error: '#ffb4ab',
    onTertiaryFixed: '#410004',
    onPrimary: '#003355',
    onSurface: '#dae2fd',
    onErrorContainer: '#ffdad6',
    surfaceVariant: '#2d3449',
    surfaceBright: '#31394d',
    onError: '#690005',
    onSecondary: '#00391d',
    surface: '#0b1326',
    surfaceContainerLowest: '#060e20',
    onTertiaryContainer: '#610008',
    onPrimaryFixedVariant: '#004a78',
    surfaceContainerHigh: '#222a3d',
    onSurfaceVariant: '#c0c7d2',
    primary: '#99cbff',
    surfaceContainerLow: '#131b2e',
    onSecondaryFixed: '#00210f',
    onBackground: '#dae2fd',
    surfaceTint: '#99cbff',
    
    // fallbacks
    danger: '#ffb4ab',
};

export const typography = {
    fontFamily: 'Inter-Regular',
    boldFontFamily: 'Inter-Bold',
    blackFontFamily: 'Inter-Black',
    
    displayMd: {
        fontFamily: 'Inter-Black',
        fontSize: 32,
        letterSpacing: -0.64, // roughly -0.02em
        lineHeight: 40,
    },
    headlineLg: {
        fontFamily: 'Inter-Bold',
        fontSize: 28,
        letterSpacing: -0.56,
        lineHeight: 36,
    },
    bodyMd: {
        fontFamily: 'Inter-Regular',
        fontSize: 16,
        lineHeight: 25.6, // 1.6
    },
    label: {
        fontFamily: 'Inter-Bold',
        fontSize: 12,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    }
};

export const spacing = {
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
};

export const effects = {
    ambientShadow: {
        shadowColor: '#060e20', // deep navy tint for shadow
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.4,
        shadowRadius: 40,
        elevation: 15,
    },
    glowShadow: {
        shadowColor: '#99cbff', 
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 8,
    }
};
