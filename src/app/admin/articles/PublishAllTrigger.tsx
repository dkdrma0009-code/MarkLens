import BulkAction from "@/components/admin-v2/BulkAction"
export default function PublishAllTrigger({ readyCount }: { readyCount: number }) {
  return <BulkAction operation="publish" loadedCount={readyCount} />
}
