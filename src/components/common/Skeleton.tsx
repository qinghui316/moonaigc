import React from 'react'

const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`skeleton ${className ?? ''}`} />
)

export default Skeleton
