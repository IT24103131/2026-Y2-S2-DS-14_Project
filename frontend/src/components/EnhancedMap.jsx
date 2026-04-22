import { useState, useEffect, useCallback, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import MarkerClusterGroup from "react-leaflet-markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

// Fix Leaflet icon paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Map tile themes
const MAP_THEMES = {
    dark: {
        url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        attribution: '&copy; <a href="https://carto.com/">CARTO</a>'
    },
    light: {
        url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
    },
    adventure: {
        url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
        attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
    },
    minimal: {
        url: "https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png",
        attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>'
    }
};

// Location categories and their styling
const LOCATION_CATEGORIES = {
    beach: { color: "#00B4D8", label: "Beach" },
    cultural: { color: "#D4A373", label: "Cultural" },
    adventure: { color: "#52B788", label: "Adventure" },
    wildlife: { color: "#F77F00", label: "Wildlife" },
    heritage: { color: "#8C3322", label: "Heritage" },
    mountain: { color: "#6C757D", label: "Mountain" },
    city: { color: "#495057", label: "City" },
    default: { color: "#8C3322", label: "Location" }
};

// Day-based color coding
const DAY_COLORS = [
    "#2E86AB", // Day 1 - Blue
    "#A23B72", // Day 2 - Purple  
    "#F18F01", // Day 3 - Orange
    "#C73E1D", // Day 4 - Red
    "#6A994E", // Day 5 - Green
    "#BC6C25", // Day 6 - Brown
    "#4A5D23", // Day 7 - Dark Green
    "#8B5A3C", // Day 8 - Tan
    "#5E548E", // Day 9 - Purple
    "#9A031E", // Day 10 - Burgundy
];

// Get location category based on name
function getLocationCategory(name = "") {
    const n = name.toLowerCase();
    if (/national park|yala|wilpattu|kumana|udawalawe|minneriya|wildlife|safari/.test(n)) return "wildlife";
    if (/beach|hikkaduwa|mirissa|tangalle|nilaveli|arugam|weligama|bentota|beruwala|kalutara|induruwa|balapitiya|kosgoda|ahungalla|ambalangoda|moragalla|negombo|unawatuna|passikuda|talalla/.test(n)) return "beach";
    if (/sigiriya|pidurangala|ella|ritigala|adam|knuckles|hike|mountain/.test(n)) return "mountain";
    if (/anuradhapura|polonnaruwa|mihintale|tissamaharama|dambulla|kataragama|temple|heritage/.test(n)) return "heritage";
    if (/kandy|peradeniya|nuwara eliya|habarana|cultural|festival/.test(n)) return "cultural";
    if (/galle|trincomalee|colombo|city/.test(n)) return "city";
    if (/adventure|rafting|climbing|trekking/.test(n)) return "adventure";
    return "default";
}

// Custom marker icon creator with simple labeled card design
function createCustomIcon(location, stopNumber, isHovered = false) {
    const dayNumber = location.day_number || 1;
    const dayColor = DAY_COLORS[(dayNumber - 1) % DAY_COLORS.length];
    
    // Truncate location name if too long
    const locationName = location.name || location.location || "Unknown";
    const displayName = locationName.length > 20 ? locationName.substring(0, 20) + "..." : locationName;
    
    return L.divIcon({
        html: `
            <div style="
                cursor: pointer;
                margin-bottom: 10px;
            ">
                <div style="
                    background: white;
                    border-radius: 8px;
                    padding: 8px 12px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                    min-width: 120px;
                    max-width: 160px;
                    font-family: 'Inter', sans-serif;
                    position: relative;
                ">
                    <div style="
                        font-size: 9px;
                        font-weight: 700;
                        color: ${dayColor};
                        margin-bottom: 4px;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    ">
                        DAY ${dayNumber} · STOP ${stopNumber}
                    </div>
                    <div style="
                        font-size: 12px;
                        font-weight: 700;
                        color: #2c3e50;
                        line-height: 1.2;
                    ">
                        ${displayName}
                    </div>
                </div>
                <div style="
                    position: absolute;
                    bottom: -8px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 0;
                    height: 0;
                    border-left: 8px solid transparent;
                    border-right: 8px solid transparent;
                    border-top: 8px solid white;
                    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
                "></div>
            </div>
        `,
        className: "",
        iconSize: [140, 50],
        iconAnchor: [70, 50],
        popupAnchor: [0, -50]
    });
}

// Custom cluster icon creator with clean colored dots
function createClusterIcon(cluster) {
    const markers = cluster.getAllChildMarkers();
    
    // Get all unique days in this cluster
    const uniqueDays = new Set();
    markers.forEach(marker => {
        const location = marker.options.location;
        if (location && location.day_number) {
            uniqueDays.add(location.day_number);
        }
    });
    
    const dayArray = Array.from(uniqueDays);
    let color;
    
    if (dayArray.length === 1) {
        // Single day - use day color
        const dayNumber = dayArray[0];
        color = DAY_COLORS[(dayNumber - 1) % DAY_COLORS.length];
    } else {
        // Mixed days - use neutral gray
        color = "#6C757D";
    }
    
    const size = 24; // Fixed small dot size
    
    return L.divIcon({
        html: `
            <div style="
                width: ${size}px;
                height: ${size}px;
                border-radius: 50%;
                background: ${color};
                border: 2px solid white;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                cursor: pointer;
            "></div>
        `,
        className: "",
        iconSize: [size, size],
        iconAnchor: [size/2, size/2],
        popupAnchor: [0, -size/2]
    });
}

// Hover tooltip component
function HoverTooltip({ location, category }) {
    const categoryInfo = LOCATION_CATEGORIES[category] || LOCATION_CATEGORIES.default;
    
    return (
        <div style={{
            background: "white",
            border: `2px solid ${categoryInfo.color}`,
            borderRadius: "12px",
            padding: "12px 16px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
            fontFamily: "'Inter', sans-serif",
            minWidth: "160px",
            transform: "translateY(-8px)"
        }}>
            <div style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "4px"
            }}>
                <span style={{ fontSize: "18px" }}>{categoryInfo.emoji}</span>
                <div style={{ fontWeight: "600", color: "#3E2723", fontSize: "14px" }}>
                    {location.name || location.location}
                </div>
            </div>
            <div style={{
                fontSize: "11px",
                color: "#8C3322",
                fontWeight: "500",
                textTransform: "uppercase",
                letterSpacing: "0.5px"
            }}>
                {categoryInfo.label}
            </div>
            {location.district && (
                <div style={{
                    fontSize: "12px",
                    color: "rgba(62,39,35,0.6)",
                    marginTop: "2px"
                }}>
                    {location.district}
                </div>
            )}
        </div>
    );
}

// Enhanced popup component with Wikimedia Commons image fetching
function EnhancedPopup({ location, category, onViewDetails }) {
    const [imageUrl, setImageUrl] = useState(null);
    const [imageLoading, setImageLoading] = useState(false);
    const [imageError, setImageError] = useState(false);
    
    const categoryInfo = LOCATION_CATEGORIES[category] || LOCATION_CATEGORIES.default;
    const locationName = location.name || location.location || "Unknown";
    
    // Fetch image from Wikimedia Commons when popup opens
    useEffect(() => {
        const fetchImage = async () => {
            setImageLoading(true);
            setImageError(false);
            
            try {
                // Search for location on Wikimedia Commons
                const searchQuery = `${locationName} Sri Lanka`;
                const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(searchQuery)}`);
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.thumbnail && data.thumbnail.source) {
                        setImageUrl(data.thumbnail.source);
                    } else {
                        setImageError(true);
                    }
                } else {
                    setImageError(true);
                }
            } catch (error) {
                console.error('Error fetching image:', error);
                setImageError(true);
            } finally {
                setImageLoading(false);
            }
        };
        
        fetchImage();
    }, [locationName]);
    
    return (
        <div style={{
            fontFamily: "'Inter', sans-serif",
            minWidth: "280px",
            maxWidth: "320px"
        }}>
            {/* Image section */}
            <div style={{
                height: "160px",
                background: imageLoading ? "#f0f0f0" : imageError ? `linear-gradient(135deg, ${categoryInfo.color}22, ${categoryInfo.color}44)` : "transparent",
                borderRadius: "12px 12px 0 0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                overflow: "hidden"
            }}>
                {imageLoading && (
                    <div style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        color: "#999"
                    }}>
                        <div style={{
                            width: "32px",
                            height: "32px",
                            border: "3px solid #f3f3f3",
                            borderTop: "3px solid #3498db",
                            borderRadius: "50%",
                            animation: "spin 1s linear infinite",
                            marginBottom: "8px"
                        }}></div>
                        <div style={{ fontSize: "12px" }}>Loading image...</div>
                    </div>
                )}
                
                {imageError && (
                    <div style={{
                        textAlign: "center",
                        color: "rgba(62,39,35,0.6)"
                    }}>
                        <div style={{ fontSize: "32px", marginBottom: "8px" }}>??</div>
                        <div style={{ fontSize: "12px" }}>No image available</div>
                    </div>
                )}
                
                {imageUrl && !imageLoading && !imageError && (
                    <img 
                        src={imageUrl} 
                        alt={locationName}
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            borderRadius: "12px 12px 0 0"
                        }}
                        onError={() => setImageError(true)}
                    />
                )}
                
                <div style={{
                    position: "absolute",
                    top: "8px",
                    left: "8px",
                    background: categoryInfo.color,
                    color: "white",
                    padding: "4px 8px",
                    borderRadius: "20px",
                    fontSize: "10px",
                    fontWeight: "600",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    zIndex: 1
                }}>
                    {categoryInfo.label}
                </div>
            </div>
            
            {/* Content section */}
            <div style={{ padding: "16px" }}>
                <h3 style={{
                    margin: "0 0 8px 0",
                    fontSize: "16px",
                    fontWeight: "600",
                    color: "#3E2723",
                    fontFamily: "'Playfair Display', serif"
                }}>
                    {locationName}
                </h3>
                
                {location.district && (
                    <div style={{
                        fontSize: "13px",
                        color: "rgba(62,39,35,0.6)",
                        marginBottom: "12px"
                    }}>
                        ?? {location.district}
                    </div>
                )}
                
                {location.description && (
                    <p style={{
                        fontSize: "13px",
                        color: "rgba(62,39,35,0.7)",
                        lineHeight: "1.5",
                        margin: "0 0 16px 0"
                    }}>
                        {location.description.length > 120 
                            ? location.description.substring(0, 120) + "..." 
                            : location.description}
                    </p>
                )}
                
                <div style={{
                    display: "flex",
                    gap: "8px",
                    alignItems: "center",
                    fontSize: "12px",
                    color: "rgba(62,39,35,0.5)",
                    marginBottom: "16px"
                }}>
                    {location.visit_duration_hours && (
                        <span>?? {location.visit_duration_hours}h</span>
                    )}
                    {location.entry_fee_usd && location.entry_fee_usd > 0 && (
                        <span>?? ${location.entry_fee_usd}</span>
                    )}
                    {(!location.entry_fee_usd || location.entry_fee_usd === 0) && (
                        <span>?? Free</span>
                    )}
                </div>
                
                <button
                    onClick={onViewDetails}
                    style={{
                        width: "100%",
                        padding: "10px 16px",
                        background: categoryInfo.color,
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        fontSize: "14px",
                        fontWeight: "600",
                        cursor: "pointer",
                        transition: "all 0.2s ease"
                    }}
                    onMouseOver={(e) => {
                        e.target.style.transform = "translateY(-1px)";
                        e.target.style.boxShadow = "0 4px 12px rgba(0,0,0,0.2)";
                    }}
                    onMouseOut={(e) => {
                        e.target.style.transform = "translateY(0)";
                        e.target.style.boxShadow = "none";
                    }}
                >
                    View Details
                </button>
            </div>
        </div>
    );
}

// Map controls component
function MapControls({ map, onLocateMe, onThemeChange, currentTheme }) {
    const handleLocateMe = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    map.flyTo([latitude, longitude], 13, {
                        duration: 1.5
                    });
                    
                    // Add a temporary marker for user location
                    L.marker([latitude, longitude])
                        .addTo(map)
                        .bindPopup("Your Location")
                        .openPopup();
                },
                (error) => {
                    console.error("Error getting location:", error);
                    alert("Could not get your location. Please check your browser settings.");
                }
            );
        } else {
            alert("Geolocation is not supported by your browser.");
        }
    };

    return (
        <div style={{
            position: "absolute",
            top: "20px",
            right: "20px",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            gap: "10px"
        }}>
            {/* Theme selector */}
            <select
                value={currentTheme}
                onChange={(e) => onThemeChange(e.target.value)}
                style={{
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "2px solid white",
                    background: "white",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                    fontSize: "12px",
                    fontWeight: "600",
                    cursor: "pointer"
                }}
            >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
                <option value="adventure">Adventure</option>
                <option value="minimal">Minimal</option>
            </select>
            
            {/* Locate me button */}
            <button
                onClick={handleLocateMe}
                style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "8px",
                    border: "2px solid white",
                    background: "white",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "18px"
                }}
                title="Find My Location"
            >
                GPS
            </button>
        </div>
    );
}

// Fit bounds component
function FitBounds({ positions }) {
    const map = useMap();
    useEffect(() => {
        if (positions.length > 0) {
            map.fitBounds(positions, { padding: [30, 30] });
        }
    }, [positions, map]);
    return null;
}

// Fly to location component
function FlyToLocation({ position, zoom = 13 }) {
    const map = useMap();
    useEffect(() => {
        if (position) {
            map.flyTo(position, zoom, {
                duration: 1.5
            });
        }
    }, [position, zoom, map]);
    return null;
}

// Main Enhanced Map Component
export default function EnhancedMap({ 
    locations = [], 
    theme = "dark",
    onLocationSelect,
    onLocationClick,
    showClusters = true, // Enable clustering by default
    center = [7.8731, 80.7718], // Sri Lanka center
    zoom = 8,
    height = "400px",
    bounds = null,
    selectedLocation = null,
    routeLines = [],
    showRouteLines = false
}) {
    const [currentTheme, setCurrentTheme] = useState(theme);
    const [hoveredMarker, setHoveredMarker] = useState(null);
    const [mapInstance, setMapInstance] = useState(null);
    const mapRef = useRef();

    // Get positions for bounds
    const positions = locations.map(loc => [loc.lat, loc.lng]).filter(Boolean);

    // Handle location click
    const handleLocationClick = useCallback((location, category) => {
        if (onLocationClick) {
            onLocationClick(location);
        }
    }, [onLocationClick]);

    // Handle view details
    const handleViewDetails = useCallback((location) => {
        if (onLocationSelect) {
            onLocationSelect(location);
        }
    }, [onLocationSelect]);

    // Cluster options with spiderfy animation
    const clusterOptions = {
        iconCreateFunction: createClusterIcon,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: true,
        zoomToBoundsOnClick: true,
        maxClusterRadius: 40,
        spiderfyDistanceMultiplier: 2,
        chunkedLoading: true,
        chunkProgress: function(processed, total, elapsed) {
            console.log(`Loading clusters: ${processed}/${total} in ${elapsed}ms`);
        }
    };

    // Render markers with or without clustering
    const renderMarkers = () => {
        // Group locations by day and calculate stop numbers within each day
        const locationsByDay = {};
        locations.forEach((location) => {
            const dayNumber = location.day_number || 1;
            if (!locationsByDay[dayNumber]) {
                locationsByDay[dayNumber] = [];
            }
            locationsByDay[dayNumber].push(location);
        });

        const markers = locations.map((location, index) => {
            const category = getLocationCategory(location.name || location.location);
            const dayNumber = location.day_number || 1;
            
            // Calculate stop number within day
            const dayLocations = locationsByDay[dayNumber] || [];
            const stopNumber = dayLocations.findIndex(loc => 
                (loc.id && loc.id === location.id) || 
                (loc.lat === location.lat && loc.lng === location.lng)
            ) + 1;
            
            return (
                <Marker
                    key={location.id || index}
                    position={[location.lat, location.lng]}
                    icon={createCustomIcon(location, stopNumber)}
                    location={location} // Pass location data for cluster access
                    eventHandlers={{
                        mousemove: (e) => e.originalEvent.stopPropagation(),
                        mouseover: (e) => e.originalEvent.stopPropagation(),
                        mouseout: (e) => e.originalEvent.stopPropagation(),
                        click: () => handleLocationClick(location, category)
                    }}
                >
                    <Popup>
                        <EnhancedPopup
                            location={location}
                            category={category}
                            onViewDetails={() => handleViewDetails(location)}
                        />
                    </Popup>
                </Marker>
            );
        });

        // Wrap in MarkerClusterGroup if clustering is enabled
        if (showClusters && locations.length > 0) {
            return (
                <MarkerClusterGroup {...clusterOptions}>
                    {markers}
                </MarkerClusterGroup>
            );
        }

        return markers;
    };

    return (
        <div style={{ 
            position: "relative", 
            height, 
            borderRadius: "12px", 
            overflow: "hidden",
            border: "2px solid rgba(255,255,255,0.1)"
        }}>
            <MapContainer
                center={center}
                zoom={zoom}
                bounds={bounds}
                style={{ height: "100%", width: "100%" }}
                ref={setMapInstance}
            >
                <TileLayer
                    url={MAP_THEMES[currentTheme].url}
                    attribution={MAP_THEMES[currentTheme].attribution}
                />

                {bounds && <FitBounds positions={positions} />}
                
                {selectedLocation && selectedLocation.lat && selectedLocation.lng && (
                    <FlyToLocation position={[selectedLocation.lat, selectedLocation.lng]} />
                )}

                {/* Render markers with clustering */}
                {renderMarkers()}

                {/* Render route lines if provided */}
                {showRouteLines && routeLines.map((route, index) => {
                    const positions = route.positions || route.path;
                    if (!positions || positions.length < 2) return null;
                    
                    // Add arrow markers at midpoints
                    const arrows = [];
                    for (let i = 0; i < positions.length - 1; i++) {
                        const start = positions[i];
                        const end = positions[i + 1];
                        const midPoint = [
                            (start[0] + end[0]) / 2,
                            (start[1] + end[1]) / 2
                        ];
                        
                        // Calculate angle for arrow
                        const angle = Math.atan2(end[1] - start[1], end[0] - start[0]) * 180 / Math.PI;
                        
                        arrows.push(
                            <Marker
                                key={`arrow-${index}-${i}`}
                                position={midPoint}
                                icon={L.divIcon({
                                    html: `
                                        <div style="
                                            transform: rotate(${angle}deg);
                                            width: 0;
                                            height: 0;
                                            border-left: 6px solid transparent;
                                            border-right: 6px solid transparent;
                                            border-bottom: 8px solid ${route.color};
                                            filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
                                        "></div>
                                    `,
                                    className: "",
                                    iconSize: [12, 8],
                                    iconAnchor: [6, 4]
                                })}
                            />
                        );
                    }
                    
                    return (
                        <div key={index}>
                            <Polyline
                                positions={positions}
                                color={route.color}
                                weight={3}
                                opacity={0.7}
                                dashArray="5, 5"
                            />
                            {arrows}
                        </div>
                    );
                })}
            </MapContainer>

            {mapInstance && (
                <MapControls
                    map={mapInstance}
                    onLocateMe={() => {}}
                    onThemeChange={setCurrentTheme}
                    currentTheme={currentTheme}
                />
            )}

            {/* Hover tooltip */}
            {hoveredMarker !== null && locations[hoveredMarker] && (
                <div
                    style={{
                        position: "absolute",
                        bottom: "20px",
                        left: "20px",
                        zIndex: 1000,
                        pointerEvents: "none"
                    }}
                >
                    <HoverTooltip
                        location={locations[hoveredMarker]}
                        category={getLocationCategory(locations[hoveredMarker].name || locations[hoveredMarker].location)}
                    />
                </div>
            )}
        </div>
    );
}

// Export utilities for other components
export { LOCATION_CATEGORIES, getLocationCategory, createCustomIcon };
