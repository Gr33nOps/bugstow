import React from 'react'
import ReactDOM from 'react-dom/client'
import RootApp from './RootApp'
import { removeRetiredSyncData } from './lib/retiredSync'
import './index.css'

removeRetiredSyncData()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RootApp />
  </React.StrictMode>,
)
