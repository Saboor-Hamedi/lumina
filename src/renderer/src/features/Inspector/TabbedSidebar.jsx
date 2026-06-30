import React from 'react'
import { Info, List as ListIcon } from 'lucide-react'
import SnippetDetails from './SnippetDetails'
import SnippetOutline from './SnippetOutline'
import ErrorBoundary from '../../components/ErrorBoundary'
import './SnippetDetails.css'

const TabbedSidebar = ({
  rightSidebarTab,
  setRightSidebarTab,
  selectedSnippet,
  isLoading
}) => {
  return (
    <div className="inspector-panel">
      {/* Tab-style header - matches workspace tabs */}
      <div
        className="panel-header-tabs workspace-tabbar"
        style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
      >
        <div 
          className={`workspace-tab ${rightSidebarTab === 'details' ? 'active' : ''}`}
          onClick={() => setRightSidebarTab('details')}
          style={{ cursor: 'pointer', borderRight: '1px solid var(--border-subtle)', paddingRight: '16px' }}
        >
          <div
            className="tab-context"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Info size={13} style={{ opacity: rightSidebarTab === 'details' ? 1 : 0.6 }} />
            <span className="tab-title" style={{ opacity: rightSidebarTab === 'details' ? 1 : 0.6 }}>Details</span>
          </div>
        </div>
        <div 
          className={`workspace-tab ${rightSidebarTab === 'outline' ? 'active' : ''}`}
          onClick={() => setRightSidebarTab('outline')}
          style={{ cursor: 'pointer', paddingRight: '16px' }}
        >
          <div
            className="tab-context"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <ListIcon size={13} style={{ opacity: rightSidebarTab === 'outline' ? 1 : 0.6 }} />
            <span className="tab-title" style={{ opacity: rightSidebarTab === 'outline' ? 1 : 0.6 }}>Outline</span>
          </div>
        </div>
        <div className="flex-1" style={{ WebkitAppRegion: 'drag', height: '100%' }} />
      </div>

      {/* Panel content */}
      <div className="panel-content">
        <ErrorBoundary>
          {rightSidebarTab === 'outline' ? (
            <SnippetOutline snippet={selectedSnippet} />
          ) : (
            <SnippetDetails snippet={selectedSnippet} isLoading={isLoading} />
          )}
        </ErrorBoundary>
      </div>
    </div>
  )
}

export default TabbedSidebar
