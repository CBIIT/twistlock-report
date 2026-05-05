import ProjectDrilldownDesign from "../../_components/ProjectDrilldownDesign";

type DrilldownPageProps = {
  params: Promise<{ project: string }>;
};

export default async function DrilldownPage({ params }: DrilldownPageProps) {
  const { project } = await params;
  return <ProjectDrilldownDesign projectSlug={project} />;
}
