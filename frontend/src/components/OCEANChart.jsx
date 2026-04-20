import {
    Radar,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    ResponsiveContainer,
    Tooltip,
} from "recharts";

export default function OCEANChart({ ocean }) {
    if (!ocean) return null;

    const data = [
        { trait: "Openness", value: ocean.openness ?? 0 },
        { trait: "Conscientiousness", value: ocean.conscientiousness ?? 0 },
        { trait: "Extraversion", value: ocean.extraversion ?? 0 },
        { trait: "Agreeableness", value: ocean.agreeableness ?? 0 },
        { trait: "Neuroticism", value: ocean.neuroticism ?? 0 },
    ];

    return (
        <div className="w-full" style={{ height: 350 }}>
            <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={data}>
                    <PolarGrid stroke="#d6d6d6" />

                    <PolarAngleAxis
                        dataKey="trait"
                        tick={{
                            fill: "rgba(62, 39, 35, 0.55)",
                            fontSize: 13,
                            fontWeight: 500,
                        }}
                    />

                    <PolarRadiusAxis
                        angle={30}
                        domain={[0, 10]}
                        tick={{ fill: "#666", fontSize: 11 }}
                    />

                    <Radar
                        name="Personality"
                        dataKey="value"
                        stroke="#2f7f77"
                        fill="#4fb3a5"
                        fillOpacity={0.6}
                        strokeWidth={2}
                    />

                    <Tooltip
                        contentStyle={{
                            background: "#ffffff",
                            border: "1px solid #ccc",
                            borderRadius: 8,
                            fontSize: 12,
                            color: "#333",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
                        }}
                    />
                </RadarChart>
            </ResponsiveContainer>
        </div>
    );
}