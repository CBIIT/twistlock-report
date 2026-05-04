import ProjectDrilldownDesign from "../../_components/ProjectDrilldownDesign";

export default function DrilldownPage({ params }: { params: { project: string } }) {
  return <ProjectDrilldownDesign projectSlug={params.project} />;
}
