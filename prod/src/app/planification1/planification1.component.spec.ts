import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Planification1Component } from './planification1.component';

describe('Planification1Component', () => {
  let component: Planification1Component;
  let fixture: ComponentFixture<Planification1Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Planification1Component]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(Planification1Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
